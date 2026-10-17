// JavaScript LangGraph registration, real in-memory example; not disk persistence.
import { StateGraph, MessagesAnnotation, MemorySaver, START, END } from '@langchain/langgraph';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

export function build(checkpointer) {
  const builder = new StateGraph(MessagesAnnotation)
    .addNode('reply', (state) => {
      const last = state.messages.at(-1);
      return { messages: [new AIMessage({ id: `answer:${last.id}`, content: `Echo: ${last.content}` })] };
    })
    .addEdge(START, 'reply')
    .addEdge('reply', END);
  return builder.compile({ checkpointer });
}

export async function demonstrate() {
  const saver = new MemorySaver();
  const graph = build(saver);
  const config = { configurable: { thread_id: 'tenant1:conversation7' } };
  await graph.invoke({ messages: [new HumanMessage({ id: 'one', content: 'hello' })] }, config);
  const second = await graph.invoke({ messages: [new HumanMessage({ id: 'two', content: 'again' })] }, config);
  return { saver, graph, config, second };
}
