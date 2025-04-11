# Mem0 for Cloudflare Workers

This is a fork of the [Mem0 repository](https://github.com/mem0ai/mem0) by Mem0AI, created to provide a **Cloudflare Workers implementation** of Mem0, based on the original **NodeJS implementation** ([NodeJS quickstart](https://docs.mem0.ai/open-source/node-quickstart)). The original Mem0 project includes both Python and NodeJS versions; this fork modifies only the NodeJS version to enable compatibility with [Cloudflare Workers](https://workers.cloudflare.com/). The NodeJS implementation relied on SQLite in two components, which were incompatible with Cloudflare Workers due to the use of the `sqlite3` library. This fork replaces those with [Cloudflare Agents](https://developers.cloudflare.com/agents/), a change specific to this repo and unlikely to be merged into the main project. Separately, this fork includes additional LLM support not originally present in the NodeJS implementation, though these enhancements may be contributed to the main Mem0 project and could be removed from this fork in the future.

## Cloudflare Workers Implementation

To enable Mem0 to run on Cloudflare Workers, the [NodeJS implementation](https://docs.mem0.ai/open-source/node-quickstart) required significant changes to its SQLite-based components. The following modifications were made:

- **Code Structure**: The original NodeJS implementation code in `mem0-ts/src/oss` was duplicated into `mem0-ts/src/oss-cfworker`, and all Cloudflare Workers-specific changes were applied in the `oss-cfworker` directory.
- **In-Memory Vector Database**: The NodeJS implementation used SQLite for an [in-memory vector database](https://docs.mem0.ai/components/vectordbs/config) to store and query vectors. The Cloudflare Workers implementation replaces it with a dedicated [Cloudflare Agent](https://developers.cloudflare.com/agents/), utilizing the [SQLite API](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/#sql-api) provided by [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/). This ensures vector storage and retrieval are compatible with Cloudflare's serverless environment.
- **History Store**: The [history store](https://docs.mem0.ai/open-source/node-quickstart#history-store), which also relied on SQLite to persist historical data, has been reimplemented using a separate [Cloudflare Agent](https://developers.cloudflare.com/agents/) with its own [SQLite storage](https://developers.cloudflare.com/agents/api-reference/store-and-sync-state/#sql-api). This maintains the history store's functionality while adhering to Cloudflare Workers' runtime constraints.
- **Preserved Core Functionality**: Beyond these database changes, the core logic and features of the NodeJS implementation remain intact, ensuring the Cloudflare Workers implementation delivers the same capabilities as the original, adapted for Cloudflare's infrastructure.
- **Future Improvements**: The current Cloudflare Workers implementation is a preliminary adaptation. A much better implementation is planned for the near future to enhance performance and integration.

These changes are specific to this fork and tailored for Cloudflare Workers compatibility, making them unlikely to be integrated into the main Mem0 repository.

## Additional LLM Support

In addition to the Cloudflare Workers-specific changes, this fork introduces support for LLMs that were not available in the NodeJS implementation as of April 11, 2025, but were supported in the Python version. These additions may be contributed to the main Mem0 project, and if merged there, they could be removed from this fork to focus solely on the Cloudflare Workers implementation. The added LLM support includes:

- **Embedding Support**: Added support for [Together.ai](https://docs.mem0.ai/components/embedders/overview) for embedding tasks.
- **LLM Support**: Added support for [LM Studio](https://docs.mem0.ai/components/llms/overview) for both normal and structured responses.
- **Neo4j Graph Memory**: The LM Studio structured response implementation supports [Neo4j Graph Memory](https://docs.mem0.ai/open-source/graph_memory/overview).

**Note**: These LLM enhancements align the NodeJS version with features already present in the Python version. If these changes are incorporated into the main Mem0 repository, this fork may discontinue maintaining them to focus exclusively on Cloudflare Workers compatibility.

## Using the Cloudflare Workers Implementation

To use the Cloudflare Workers implementation, you need to configure the vector store and history store to use [Cloudflare Agents](https://developers.cloudflare.com/agents/) instead of SQLite, and set up your Cloudflare Worker environment with the necessary Durable Objects bindings. Below are the steps to update your configuration and deploy the application.

### Vector Store Configuration

The original NodeJS implementation used SQLite for the vector store. Here’s the old configuration:

```javascript
const configMemory = {
  vectorStore: {
	provider: 'memory',
	config: {
	  collectionName: 'memories',
	  dimension: 1536,
	},
  },
};
```

In the Cloudflare Workers implementation, the vector store uses a Cloudflare Agent. Update your configuration as follows:

```javascript
import type { AgentNamespace } from "agents";
import type { CfMemoryAgent } from "mem0ai-oss-cfworker";

export interface Env {
  MEMORY_AGENT: AgentNamespace<CfMemoryAgent>;
}

// In your Cloudflare Worker
const configMemory = {
  vectorStore: {
	provider: "memory",
	config: {
	  collectionName: 'memories', // Can be any name; used as the Cloudflare Agent ID
	  dimension: 1536,
	  agentBinding: this.env.MEMORY_AGENT,
	},
  },
};
```

### History Store Configuration

The original NodeJS implementation used SQLite for the history store. Here’s the old configuration:

```javascript
const configMemory = {
  historyStore: {
	provider: 'sqlite',
	config: {
	  historyDbPath: "memory.db",
	},
  },
  historyDbPath: "memory.db", // Optional default
};
```

In the Cloudflare Workers implementation, the history store uses a separate Cloudflare Agent. Update your configuration as follows:

```javascript
import type { AgentNamespace } from "agents";
import type { CfHistoryManagerAgent } from "mem0ai-oss-cfworker";

export interface Env {
  HISTORY_AGENT: AgentNamespace<CfHistoryManagerAgent>;
}

// In your Cloudflare Worker
const configMemory = {
  historyStore: {
	provider: 'cfagent',
	config: {
	  agentBinding: this.env.HISTORY_AGENT,
	  agentHistoryName: "memory_history", // Can be any name; used as the Cloudflare Agent ID
	},
  },
};
```

### Cloudflare Worker Environment Setup

To enable Cloudflare Agents, you must configure Durable Objects in your Cloudflare Worker’s `wrangler.toml` or `wrangler.jsonc` file. Add the following:

```toml
{
  "name": "my-worker",
  "durable_objects": {
	"bindings": [
	  {
		"name": "MEMORY_AGENT",
		"class_name": "CfMemoryAgent" # Must be exactly this name
	  },
	  {
		"name": "HISTORY_AGENT",
		"class_name": "CfHistoryManagerAgent" # Must be exactly this name
	  }
	]
  },
  "migrations": [
	{
	  "tag": "v1",
	  "new_sqlite_classes": [
		"CfMemoryAgent",
		"CfHistoryManagerAgent"
	  ]
	}
  ]
}
```

- **Durable Objects Configuration**: The `durable_objects.bindings` section defines the bindings for the vector store (`MEMORY_AGENT`) and history store (`HISTORY_AGENT`), linking to the specific agent classes (`CfMemoryAgent` and `CfHistoryManagerAgent`). For more details, see the [Cloudflare Agents configuration documentation](https://developers.cloudflare.com/agents/api-reference/configuration/).
- **Migrations**: The `migrations` section registers the SQLite-based agent classes for use with Durable Objects. For more information on managing migrations, refer to the [Cloudflare Durable Objects migrations documentation](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/).

Ensure your Worker is deployed with these configurations to enable the Cloudflare Agents for both the vector store and history store.

## Getting Started

For detailed instructions on how to use Mem0, including its features, configuration, and APIs for both the Python and [NodeJS versions](https://docs.mem0.ai/open-source/node-quickstart), please refer to the [original Mem0 repository](https://github.com/mem0ai/mem0). The original README provides comprehensive guidance on setting up and using Mem0.

## Contributing

Contributions are welcome! For suggestions, bug reports, or improvements to the Cloudflare Workers implementation, please open an issue or submit a pull request. Contributions related to the additional LLM support may be better directed to the [main Mem0 repository](https://github.com/mem0ai/mem0), as those features could be merged there. Be sure to check the original repository’s contribution guidelines.

## License

This fork is licensed under the same terms as the original Mem0 repository. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the [Mem0AI team](https://github.com/mem0ai) for creating the original Mem0 project, including its Python and [NodeJS versions](https://docs.mem0.ai/open-source/node-quickstart).
- Built with [Cloudflare Workers](https://workers.cloudflare.com/), [Cloudflare Agents](https://developers.cloudflare.com/agents/), and [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/).