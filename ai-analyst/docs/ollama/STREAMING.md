# Web search

Ollama's web search API can be used to augment models with the latest information to reduce hallucinations and improve accuracy.

Web search is provided as a REST API with deeper tool integrations in the Python and JavaScript libraries. This also enables models like OpenAI’s gpt-oss models to conduct long-running research tasks.

## Authentication

For access to Ollama's web search API, create an [API key](https://ollama.com/settings/keys). A free Ollama account is required.

## Web search API

Performs a web search for a single query and returns relevant results.

### Request

`POST https://ollama.com/api/web_search`

* `query` (string, required): the search query string
* `max_results` (integer, optional): maximum results to return (default 5, max 10)

### Response

Returns an object containing:

* `results` (array): array of search result objects, each containing:
  * `title` (string): the title of the web page
  * `url` (string): the URL of the web page
  * `content` (string): relevant content snippet from the web page

### Examples

<Note>
  Ensure OLLAMA\_API\_KEY is set or it must be passed in the Authorization header.
</Note>

#### cURL Request

```bash  theme={"system"}
curl https://ollama.com/api/web_search \
  --header "Authorization: Bearer $OLLAMA_API_KEY" \
	-d '{
	  "query":"what is ollama?"
	}'
```

**Response**

```json  theme={"system"}
{
  "results": [
    {
      "title": "Ollama",
      "url": "https://ollama.com/",
      "content": "Cloud models are now available..."
    },
    {
      "title": "What is Ollama? Introduction to the AI model management tool",
      "url": "https://www.hostinger.com/tutorials/what-is-ollama",
      "content": "Ariffud M. 6min Read..."
    },
    {
      "title": "Ollama Explained: Transforming AI Accessibility and Language ...",
      "url": "https://www.geeksforgeeks.org/artificial-intelligence/ollama-explained-transforming-ai-accessibility-and-language-processing/",
      "content": "Data Science Data Science Projects Data Analysis..."
    }
  ]
}
```

#### Python library

```python  theme={"system"}
import ollama
response = ollama.web_search("What is Ollama?")
print(response)
```

**Example output**

```python  theme={"system"}

results = [
    {
        "title": "Ollama",
        "url": "https://ollama.com/",
        "content": "Cloud models are now available in Ollama..."
    },
    {
        "title": "What is Ollama? Features, Pricing, and Use Cases - Walturn",
        "url": "https://www.walturn.com/insights/what-is-ollama-features-pricing-and-use-cases",
        "content": "Our services..."
    },
    {
        "title": "Complete Ollama Guide: Installation, Usage & Code Examples",
        "url": "https://collabnix.com/complete-ollama-guide-installation-usage-code-examples",
        "content": "Join our Discord Server..."
    }
]

```

More Ollama [Python example](https://github.com/ollama/ollama-python/blob/main/examples/web-search.py)

#### JavaScript Library

```tsx  theme={"system"}
import { Ollama } from "ollama";

const client = new Ollama();
const results = await client.webSearch({ query: "what is ollama?" });
console.log(JSON.stringify(results, null, 2));
```

**Example output**

```json  theme={"system"}
{
  "results": [
    {
      "title": "Ollama",
      "url": "https://ollama.com/",
      "content": "Cloud models are now available..."
    },
    {
      "title": "What is Ollama? Introduction to the AI model management tool",
      "url": "https://www.hostinger.com/tutorials/what-is-ollama",
      "content": "Ollama is an open-source tool..."
    },
    {
      "title": "Ollama Explained: Transforming AI Accessibility and Language Processing",
      "url": "https://www.geeksforgeeks.org/artificial-intelligence/ollama-explained-transforming-ai-accessibility-and-language-processing/",
      "content": "Ollama is a groundbreaking..."
    }
  ]
}
```

More Ollama [JavaScript example](https://github.com/ollama/ollama-js/blob/main/examples/websearch/websearch-tools.ts)

## Web fetch API

Fetches a single web page by URL and returns its content.

### Request

`POST https://ollama.com/api/web_fetch`

* `url` (string, required): the URL to fetch

### Response

Returns an object containing:

* `title` (string): the title of the web page
* `content` (string): the main content of the web page
* `links` (array): array of links found on the page

### Examples

#### cURL Request

```python  theme={"system"}
curl --request POST \
  --url https://ollama.com/api/web_fetch \
  --header "Authorization: Bearer $OLLAMA_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
      "url": "ollama.com"
  }'
```

**Response**

```json  theme={"system"}
{
  "title": "Ollama",
  "content": "[Cloud models](https://ollama.com/blog/cloud-models) are now available in Ollama...",
  "links": [
    "http://ollama.com/",
    "http://ollama.com/models",
    "https://github.com/ollama/ollama"
  ]

```

#### Python SDK

```python  theme={"system"}
from ollama import web_fetch

result = web_fetch('https://ollama.com')
print(result)
```

**Result**

```python  theme={"system"}
WebFetchResponse(
    title='Ollama',
    content='[Cloud models](https://ollama.com/blog/cloud-models) are now available in Ollama\n\n**Chat & build
with open models**\n\n[Download](https://ollama.com/download) [Explore
models](https://ollama.com/models)\n\nAvailable for macOS, Windows, and Linux',
    links=['https://ollama.com/', 'https://ollama.com/models', 'https://github.com/ollama/ollama']
)
```

#### JavaScript SDK

```tsx  theme={"system"}
import { Ollama } from "ollama";

const client = new Ollama();
const fetchResult = await client.webFetch({ url: "https://ollama.com" });
console.log(JSON.stringify(fetchResult, null, 2));
```

**Result**

```json  theme={"system"}
{
  "title": "Ollama",
  "content": "[Cloud models](https://ollama.com/blog/cloud-models) are now available in Ollama...",
  "links": [
    "https://ollama.com/",
    "https://ollama.com/models",
    "https://github.com/ollama/ollama"
  ]
}
```

## Building a search agent

Use Ollama’s web search API as a tool to build a mini search agent.

This example uses Alibaba’s Qwen 3 model with 4B parameters.

```bash  theme={"system"}
ollama pull qwen3:4b
```

```python  theme={"system"}
from ollama import chat, web_fetch, web_search

available_tools = {'web_search': web_search, 'web_fetch': web_fetch}

messages = [{'role': 'user', 'content': "what is ollama's new engine"}]

while True:
  response = chat(
    model='qwen3:4b',
    messages=messages,
    tools=[web_search, web_fetch],
    think=True
    )
  if response.message.thinking:
    print('Thinking: ', response.message.thinking)
  if response.message.content:
    print('Content: ', response.message.content)
  messages.append(response.message)
  if response.message.tool_calls:
    print('Tool calls: ', response.message.tool_calls)
    for tool_call in response.message.tool_calls:
      function_to_call = available_tools.get(tool_call.function.name)
      if function_to_call:
        args = tool_call.function.arguments
        result = function_to_call(**args)
        print('Result: ', str(result)[:200]+'...')
        # Result is truncated for limited context lengths
        messages.append({'role': 'tool', 'content': str(result)[:2000 * 4], 'tool_name': tool_call.function.name})
      else:
        messages.append({'role': 'tool', 'content': f'Tool {tool_call.function.name} not found', 'tool_name': tool_call.function.name})
  else:
    break
```

**Result**

```
Thinking:  Okay, the user is asking about Ollama's new engine. I need to figure out what they're referring to. Ollama is a company that develops large language models, so maybe they've released a new model or an updated version of their existing engine....

Tool calls:  [ToolCall(function=Function(name='web_search', arguments={'max_results': 3, 'query': 'Ollama new engine'}))]
Result:  results=[WebSearchResult(content='# New model scheduling\n\n## September 23, 2025\n\nOllama now includes a significantly improved model scheduling system. Ahead of running a model, Ollama’s new engine

Thinking:  Okay, the user asked about Ollama's new engine. Let me look at the search results.

First result is from September 23, 2025, talking about new model scheduling. It mentions improved memory management, reduced crashes, better GPU utilization, and multi-GPU performance. Examples show speed improvements and accurate memory reporting. Supported models include gemma3, llama4, qwen3, etc...

Content:  Ollama has introduced two key updates to its engine, both released in 2025:

1. **Enhanced Model Scheduling (September 23, 2025)**
   - **Precision Memory Management**: Exact memory allocation reduces out-of-memory crashes and optimizes GPU utilization.
   - **Performance Gains**: Examples show significant speed improvements (e.g., 85.54 tokens/s vs 52.02 tokens/s) and full GPU layer utilization.
   - **Multi-GPU Support**: Improved efficiency across multiple GPUs, with accurate memory reporting via tools like `nvidia-smi`.
   - **Supported Models**: Includes `gemma3`, `llama4`, `qwen3`, `mistral-small3.2`, and more.

2. **Multimodal Engine (May 15, 2025)**
   - **Vision Support**: First-class support for vision models, including `llama4:scout` (109B parameters), `gemma3`, `qwen2.5vl`, and `mistral-small3.1`.
   - **Multimodal Tasks**: Examples include identifying animals in multiple images, answering location-based questions from videos, and document scanning.

These updates highlight Ollama's focus on efficiency, performance, and expanded capabilities for both text and vision tasks.
```

### Context length and agents

Web search results can return thousands of tokens. It is recommended to increase the context length of the model to at least \~32000 tokens. Search agents work best with full context length. [Ollama's cloud models](https://docs.ollama.com/cloud) run at the full context length.

## MCP Server

You can enable web search in any MCP client through the [Python MCP server](https://github.com/ollama/ollama-python/blob/main/examples/web-search-mcp.py).

### Cline

Ollama's web search can be integrated with Cline easily using the MCP server configuration.

`Manage MCP Servers` > `Configure MCP Servers` > Add the following configuration:

```json  theme={"system"}
{
  "mcpServers": {
    "web_search_and_fetch": {
      "type": "stdio",
      "command": "uv",
      "args": ["run", "path/to/web-search-mcp.py"],
      "env": { "OLLAMA_API_KEY": "your_api_key_here" }
    }
  }
}
```

<img src="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=046239fbe74a8e928752b97b1a8954fa" alt="Cline MCP Configuration" data-og-width="852" width="852" data-og-height="1078" height="1078" data-path="images/cline-mcp.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?w=280&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=251a7ae4c99cafbeff8867a3cdefc854 280w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?w=560&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=bde250f5b99530b1870b5e7069abf10c 560w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?w=840&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=067e154d817a737cd508f74cffa77294 840w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?w=1100&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=c5db90800a313a6b262fcd37ab5be97f 1100w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?w=1650&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=1c20c4081d1e8f13a3da2348c6df1fd0 1650w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/cline-mcp.png?w=2500&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=2dbaea69c8eefd988ec6c065ce966187 2500w" />

### Codex

Ollama works well with OpenAI's Codex tool.

Add the following configuration to `~/.codex/config.toml`

```python  theme={"system"}
[mcp_servers.web_search]
command = "uv"
args = ["run", "path/to/web-search-mcp.py"]
env = { "OLLAMA_API_KEY" = "your_api_key_here" }
```

<img src="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=775b41bb85af7836b0a5a609de7d1f6f" alt="Codex MCP Configuration" data-og-width="1150" width="1150" data-og-height="1014" height="1014" data-path="images/codex-mcp.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?w=280&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=165618dddf9daa7f355f71c454ba3f41 280w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?w=560&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=79585e40dfb53f5fffc4a637a5119118 560w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?w=840&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=ca1d7acc055ebdbc409d9f372d9ca3e5 840w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?w=1100&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=603c85032a6b8dd755950c9d29f8fd21 1100w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?w=1650&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=07665e9ee289fdabb9addde3a06bca7a 1650w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/codex-mcp.png?w=2500&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=f885735a8b1c269439f9ccf10424421e 2500w" />

### Goose

Ollama can integrate with Goose via its MCP feature.

<img src="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=5fea6e0aab7865dc950470f004c549e8" alt="Goose MCP Configuration 1" data-og-width="1152" width="1152" data-og-height="1012" height="1012" data-path="images/goose-mcp-1.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?w=280&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=f7ccec9b53d39d84ed10bdedd0335e33 280w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?w=560&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=cb5464f221b561eba98c10702222d4fe 560w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?w=840&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=0810ea78c85815474a17d5c1d975771a 840w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?w=1100&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=67467cb3aaab1183f1f850a4061a7af0 1100w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?w=1650&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=2e8e9d972510ba17d542156b8c7a5142 1650w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-1.png?w=2500&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=f990a9ba7d6daf66e89699617034e6b9 2500w" />

<img src="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=c69c12389f7dd60ef1c53cd10af82a7d" alt="Goose MCP Configuration 2" data-og-width="1146" width="1146" data-og-height="1006" height="1006" data-path="images/goose-mcp-2.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?w=280&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=498deaa0c52aa33e32f4962e0dea9dc7 280w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?w=560&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=bb62f0113619a0f572e0017849a65bb5 560w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?w=840&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=7035aae8c4163df72f38d885f11e3f1c 840w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?w=1100&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=ca8a2966d7c350c6d75d9252f86f7be8 1100w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?w=1650&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=a488d0de5bf91dccd78a5187e712ceb2 1650w, https://mintcdn.com/ollama-9269c548/lS1IbrlCxMxm029K/images/goose-mcp-2.png?w=2500&fit=max&auto=format&n=lS1IbrlCxMxm029K&q=85&s=fa84ce84ab908bacd6853048972bff7c 2500w" />

### Other integrations

Ollama can be integrated into most of the tools available either through direct integration of Ollama's API, Python / JavaScript libraries, OpenAI compatible API, and MCP server integration.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.ollama.com/llms.txt