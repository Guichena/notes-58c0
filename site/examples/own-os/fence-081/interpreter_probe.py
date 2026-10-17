"""CPython3.12 teaching probe; compiles a constant authored fixture, no user input."""
import ast
import dis
import types

def main():
    src = "def twice(x):\n    return x + x\nanswer = twice(21)\n"
    tree = ast.parse(src, filename="fixture.py", mode="exec")
    module = compile(tree, "fixture.py", "exec")
    assert isinstance(module, types.CodeType)
    body = next(x for x in module.co_consts if isinstance(x, types.CodeType))
    assert body.co_name == "twice" and body.co_varnames == ("x",)
    instructions = list(dis.get_instructions(body))
    assert any(x.opname == "LOAD_FAST" for x in instructions)
    assert any(x.opname == "RETURN_VALUE" for x in instructions)
    namespace = {}
    assert "answer" not in namespace
    exec(module, namespace)
    assert namespace["answer"] == 42
    f = namespace["twice"]
    assert f.__code__ is body and f(5) == 10
    instructions_before = body.co_code
    for _ in range(10000): assert f(3) == 6
    # Adaptive instructions are version-specific; don't assert one opcode layout.
    dis.dis(f, adaptive=True, show_caches=True)
    assert body.co_code == instructions_before
    try: compile("def :", "bad.py", "exec")
    except SyntaxError: pass
    else: raise AssertionError("syntax error expected before execution")
    print("PASS CPython compile/code/function/exec/dis; 10000 hot calls")
if __name__ == "__main__": main()

