import {
  InMemoryCache
} from 'apollo-cache-inmemory';
const _ = require('lodash');

/**
 * retrieveQueryName takes in a query AST and drills down to get the "value" property from the OperationDefinition.
 * This function, in short, returns the "name" of a query.
 * *** IMPORTANT: This file assumes that all queries are NAMED!!!
 */
const retrieveQueryName = (query) => {
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
export default class cacheQLive extends InMemoryCache {
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

    const writeQueryName = retrieveQueryName(write.query); //Something like "GETAUTHORS"

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

  read(query) {
    //if you read the initial query from the cache, just return that entire document result
    if (this.findMainQueries(query)) {
      return this._INITIAL_QUERY.result;
    }
    //otherwise, default to the IMC read property;
    return super.read(query)
  }

  diff(query) {
    //if you want to request the initial query from the cache, we return the entire document result and set the flag to true because we know the whole document is present;
    if (this.findMainQueries(query)) {
      return {
        result: this._INITIAL_QUERY.result,
        complete: true
      };
    }
    //otherwise, use the diff method on IMC, which will return as many cached fields for a query as possible and will also return a boolean stating whether or not all of the fields of the query were returned;
    //this is probably where we need to add the logic to catch that true or false flag and then determine which parts of the query weren't in the cache, and restructure the rest of the query that needs to be sent to get all of the requested data;
    return super.diff(query)
  }


  /**
   * This looks like a method that Jeff added, lol. It's used as a helper method in both "read" and "diff".
   * It seeeeems like this method returns true if the query that's passed in represents the same data as the Big Document stored in the cache.
   */

  useInitialQuery(query) {
    const currentQueryName = retrieveQueryName(query.query); //Something like "GETAUTHORS"

    return (
      this.initialQueryNames &&
      this.initialQueryNames.includes(currentQueryName) &&
      this[currentQueryName] &&
      _.isEqual(this[currentQueryName].variables, query.variables)
    )
  }
}