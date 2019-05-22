import { InMemoryCache } from 'apollo-cache-inmemory';

const _ = require('lodash');

/*

retrieveQueryName() traverses through the AST (Abstract-Syntax-Tree) to aquire the current query's name, in order to compare against queries already cached.
In order to retrieve query name via path in retrieveQueryName(), query must be written in this format: 

		query <query_name>(<optional_arguments>) {
			selection set(<optional_arguments>) {
				sub-selection set {
				
				}
			}
		}

The name property on the OperationDefinition object references the actual name of the query; i.e. in query getFeed, getFeed is the name value.

*/

const retrieveQueryName = (currentQuery) => {
	const definitions = query.definitions;
	if (definitions && definitions.length) {
		const operationDefinition = definitions.filter(
			({ kind }) => kind === 'OperationDefinition'
		);
		return (
			operationDefinition[i].name &&
			operationDefinition[i].name.value
		);
	}
	return null;
}


//mainQueryNames should be an array of strings where the strings are the names of the queries to be stored as denormalized documents;
//configObject should be the default configuration object that you would usually pass to InMemoryCache;

class cacheQLive extends InMemoryCache {
	constructor(mainQueryNames, configObject) {
		super(configObject);
		this.mainQueryNames = mainQueryNames;
	}

	//these methods need to be fixed to account for an array of initial queries instead of just a single initial query; we do think that they are necessary though since we want to store in our optimized cache and in the IMC;
	// extract(optimistic) {
	// 	const normalizedCache = super.extract(optimistic);
	// 	return { _INITIAL_QUERY: this._INITIAL_QUERY, ...normalizedCache };
	// }
	// restore(data) {
	// 	this._INITIAL_QUERY = data._INITIAL_QUERY;
	// 	return super.restore(data);
	// }

	reset() {
		this.mainQueryNames = null;
		return super.reset();
	}

	// write(write) {
	// 	//if the initialQuery name exists, if the name is under the OperationDefinition, and it's not the inital query requested...
	// 	if (this.initialQueryName && this.initialQueryName === getQueryName(write.query) && !this._INITIAL_QUERY) {
	// 		this._INITIAL_QUERY = {
	// 			result: write.result,
	// 			variables: write.variables
	// 		}
	// 		//broadcastWatches "broadcasts" changes that are made by writing to the cache or the server(it works with optimistic in the sense that the UI is updated before the changes are broadcast to the cache)
	// 		super.broadcastWatches();
	// 		return;
	// 	}
	// 	super.write(write);
	// }


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
		if (this.useInitialQuery(query)) {
			return { result: this._INITIAL_QUERY.result, complete: true };
		}
		//otherwise, use the diff method on IMC, which will return as many cached fields for a query as possible and will also return a boolean stating whether or not all of the fields of the query were returned;
		//this is probably where we need to add the logic to catch that true or false flag and then determine which parts of the query weren't in the cache, and restructure the rest of the query that needs to be sent to get all of the requested data;
		return super.diff(query)
	}

	findMainQueries(query) {
		const currentQueryName = retrieveQueryName(query);
		for (let i = 0; i < mainQueryNames.length; i += 1) {
			if (mainQueryNames[i] === currentQueryName) {
				if (_.isEqual(query.variable))
			}
		}
		return (
			this.initialQueryName &&
			this.initialQueryName === retrieveQueryName(query.query) &&
			this._INITIAL_QUERY &&
			_.isEqual(this._INITIAL_QUERY.variable, query.variable)
			//query.VariableDefinition.variable.name.value
		)
	}

}