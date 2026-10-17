-- Lua 5.4.  Run as an isolated process: lua lua_gc.lua
assert(_VERSION == "Lua 5.4", "this example targets Lua 5.4")
local function fullCollection()
    collectgarbage("collect")
    collectgarbage("collect")
end

for _, mode in ipairs({"incremental", "generational"}) do
    collectgarbage(mode)
    local weak = setmetatable({}, {__mode = "v"})
    local owner = {child = {label = "live"}}
    weak[1] = owner.child
    fullCollection()
    assert(weak[1] == owner.child)

    owner.child = nil
    fullCollection()
    assert(weak[1] == nil)

    local function makeCycle()
        local a, b = {}, {}
        a.peer, b.peer = b, a
        weak[2], weak[3] = a, b
    end
    makeCycle()
    fullCollection()
    assert(weak[2] == nil and weak[3] == nil)

    local function makeClosure()
        local held = {label = "upvalue"}
        weak[4] = held
        return function() return held end
    end
    local keep = makeClosure()
    fullCollection()
    assert(weak[4] == keep())
    keep = nil
    fullCollection()
    assert(weak[4] == nil)

    local ephemeron = setmetatable({}, {__mode = "k"})
    local function makeKeyValueCycle()
        local key = {}
        ephemeron[key] = {back = key}
    end
    makeKeyValueCycle()
    fullCollection()
    assert(next(ephemeron) == nil)
    print("PASS: " .. mode .. " reachability examples")
end
