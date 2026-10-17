"""LangGraph 1.2.14 + checkpoint-sqlite 3.1.1, deterministic nodes, no LLM/network."""
import os
os.environ['LANGGRAPH_STRICT_MSGPACK']='true'
os.environ['LANGSMITH_TRACING']='false'
from langchain_core.messages import AIMessage,HumanMessage
from langgraph.graph import StateGraph,MessagesState,START,END

class State(MessagesState):
    turn_id: str

def build(checkpointer, visits=None):
    def draft(state):
        if visits is not None:visits.append(('draft',len(state['messages'])))
        question=next(m.content for m in reversed(state['messages']) if isinstance(m,HumanMessage))
        return {'messages':[AIMessage(id='draft:'+state['turn_id'],content='Draft: '+question)]}
    def finish(state):
        if visits is not None:visits.append(('finish',len(state['messages'])))
        return {'messages':[AIMessage(id='answer:'+state['turn_id'],content='Checked: '+state['messages'][-1].content)]}
    builder=StateGraph(State)
    builder.add_node('draft',draft)
    builder.add_node('finish',finish)
    builder.add_edge(START,'draft')
    builder.add_edge('draft','finish')
    builder.add_edge('finish',END)
    return builder.compile(checkpointer=checkpointer)

if __name__=='__main__':
    import json,sys
    from langgraph.checkpoint.sqlite import SqliteSaver
    path,mode=sys.argv[1:3]
    config={'configurable':{'thread_id':'demo:tenant1:thread7'}}
    with SqliteSaver.from_conn_string(path) as saver:
        graph=build(saver)
        if mode=='start':
            graph.invoke({'turn_id':'u1','messages':[HumanMessage(id='u1',content='hello')]},config,durability='sync')
        elif mode=='continue':
            graph.invoke({'turn_id':'u2','messages':[HumanMessage(id='u2',content='again')]},config,durability='sync')
        elif mode!='inspect':raise ValueError(mode)
        state=graph.get_state(config)
        print(json.dumps({'ids':[m.id for m in state.values['messages']],'next':state.next}))
