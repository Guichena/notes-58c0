-- Lua 5.4.  Run: lua lua_oop.lua
local Account = {}
Account.__index = Account

function Account:new(balance)
    assert(type(balance) == "number" and balance >= 0,
           "balance must be a nonnegative number")
    return setmetatable({balance = balance, history = {}}, self)
end

function Account:deposit(amount)
    assert(type(amount) == "number" and amount > 0,
           "amount must be positive")
    self.balance = self.balance + amount
    self.history[#self.history + 1] = amount
    return self.balance
end

function Account:withdraw(amount)
    assert(type(amount) == "number" and amount > 0,
           "amount must be positive")
    if amount > self.balance then
        return false, "insufficient funds"
    end
    self.balance = self.balance - amount
    self.history[#self.history + 1] = -amount
    return true
end

local FeeAccount = setmetatable({}, {__index = Account})
FeeAccount.__index = FeeAccount

function FeeAccount:new(balance, fee)
    assert(type(fee) == "number" and fee >= 0,
           "fee must be a nonnegative number")
    local obj = Account.new(self, balance)
    obj.fee = fee
    return obj
end

function FeeAccount:withdraw(amount)
    assert(type(amount) == "number" and amount > 0,
           "amount must be positive")
    return Account.withdraw(self, amount + self.fee)
end

local a = Account:new(100)
local b = Account:new(50)
assert(a:deposit(20) == 120)
assert(a:withdraw(30) and a.balance == 90)
local ok, reason = b:withdraw(60)
assert(not ok and reason == "insufficient funds")
assert(b.balance == 50 and #b.history == 0)
assert(a.history ~= b.history and #a.history == 2)
assert(rawget(a, "deposit") == nil and a.deposit == Account.deposit)
assert(getmetatable(a) == Account)
assert(not pcall(function() a:deposit(-1) end))

local c = FeeAccount:new(100, 2)
assert(c:withdraw(10) and c.balance == 88)
assert(c:deposit(5) == 93)
assert(getmetatable(c) == FeeAccount)
assert(c.deposit == Account.deposit)

local original = Account.deposit
Account.deposit = function(self, amount)
    return original(self, amount * 2)
end
assert(b:deposit(5) == 60) -- shared method lookup observes replacement
Account.deposit = original

local function newCounter(initial)
    local value = initial
    return {
        increment = function()
            value = value + 1
            return value
        end,
        get = function() return value end,
    }
end
local private = newCounter(0)
assert(private.increment() == 1 and private.get() == 1)
assert(private.value == nil)
print("PASS: Lua OOP bounded examples")
