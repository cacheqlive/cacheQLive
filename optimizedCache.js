const {
  InMemoryCache
} = require('apollo-cache-inmemory');

const _ = require('lodash');

/**
 * getQueryName takes in a query AST and drills down to get the "value" property from the OperationDefinition.
 * This function, in short, returns the "name" of a query.
 * *** IMPORTANT: This file assumes that all queries are NAMED!!!
 */
const getQueryName = (query) => {
  const defs = query.definitions;
  if (defs && defs.length) {
    const operationDefinition = defs.filter(
      ({
        kind
      }) => kind === 'OperationDefinition'
    );
    return (
      operationDefinition.length &&
      operationDefinition[0].name &&
      operationDefinition[0].name.value
    );
  }
  return null;
};

/**
 * Optimized version of InMemoryCache which caches the first execution 
 * of `initialQueryName` named query for the initial pageload.
 */
export default class OptimizedInMemoryCache extends InMemoryCache {
  // initalQueryNames is an array of strings that represent the names of the queries that we want to be inserted as documents into our cache.
  // configOptions is the "usual" object that is passed to InMemoryCache to configure its behaviour.
  constructor(initialQueryNames = [], configOptions) {
    super(configOptions);
    this.initialQueryNames = initialQueryNames;
  }

  /**
   * Usually, extract returns a serialized version of the ApolloCache which will be passed to "restore" client-side.
   * The extract serialized format doesn't matter so long as "restore" properly de-serializes it.
   * That's the GENERAL functionality -- we may modify it below.
   */
  extract(optimistic) {
    const normalizedCache = super.extract(optimistic);
    return {
      _INITIAL_QUERY: this._INITIAL_QUERY,
      ...normalizedCache
    };
  }

  /**
   * Restore is the counterpart to "extract". It takes the output of "extract" and uses it to populate the cache with the given serialized data passed in as args.
   */
  restore(data) {
    this._INITIAL_QUERY = data._INITIAL_QUERY;
    return super.restore(data);
  }

  /**
   * Reset clears the cache contents.
   */
  reset() {
    this._INITIAL_QUERY = null;
    return super.reset();
  }

  /**
   * The main write method which "writeQuery" and "writeFragment" use to write the results of a GraphQL query or fragment to the store. 
   * Just like "read", ApolloCache provides implementations for "writeQuery" and "writeFragment", so all that's required is a "read" implementation
   */
  // OUR ATTEMPT AT MODIFYING BEHAVIOR TO ALLOW FOR N "WatchedQueries"
  write(write) {
    // FIRST check that 1. we've had something passed in to the constructor as a query name to watch 
    // AND that 2. the query name that we're watching is equal to the queryName of the query that we're writing
    // AND that 3. we haven't yet written to the _INITIAL_QUERY property in our optimizedCache.

    const writeQueryName = getQueryName(write.query); //Something like "GETAUTHORS"

    if (
      this.initialQueryNames &&
      this.initialQueryNames.includes(writeQueryName) //&&
      // !this._INITIAL_QUERY //THIS MAY CHANGE... This makes sense for his 1 initial big query, but perhaps not for ours
    ) {
      // Save the first query, don't normalize this to the cache
      this[writeQueryName] = {
        result: write.result, //?
        variables: write.variables //?
      };
      super.broadcastWatches(); // What does this do? Unsure! See: https://github.com/apollographql/apollo-client/blob/master/packages/apollo-cache-inmemory/src/inMemoryCache.ts
      console.log(this)
      return;
    }
    console.log(this)
    super.write(write);
  }

  /**
   * This is the main method which readQuery and readFragment use to fetch the cached results of a given GraphQL query or fragment.
   * readQuery and readFragment are already implemented on the ApolloCache base class, so all that's required is a read implementation.
   */
  read(query) {
    if (this.useInitialQuery(query)) {
      return this._INITIAL_QUERY.result;
    }
    return super.read(query);
  }


  /**
   * "diff" is a method used by ApolloClient to return as many cached fields for a given GraphQL query as possible... It also returns a FLAG indicating whether or not ALL of the query's
   * fields were present in the cache. If any are missing, the ApolloClient will need to fetch the additional fields from the server (but I don't believe diff does that for you).
   */
  diff(query) {
    if (this.useInitialQuery(query)) {
      return {
        result: this._INITIAL_QUERY.result,
        complete: true
      };
    }
    return super.diff(query);
  }

  /**
   * This looks like a method that Jeff added, lol. It's used as a helper method in both "read" and "diff".
   * It seeeeems like this method returns true if the query that's passed in represents the same data as the Big Document stored in the cache.
   */
  useInitialQuery(query) {
    return (
      this.initialQueryName &&
      this.initialQueryName === getQueryName(query.query) &&
      this._INITIAL_QUERY &&
      _.isEqual(this._INITIAL_QUERY.variables, query.variables) // This isEqual method isn't native to Javascript... we imported lodash, which has an isEqual method
    );
  }
}