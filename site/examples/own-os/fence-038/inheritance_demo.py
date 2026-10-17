class Parent:
    def __init__(self, name):
        self.name = name

    def describe(self):
        return "parent:" + self.name


class Child(Parent):
    def __init__(self, name, level):
        super().__init__(name)
        self.level = level

    def describe(self):
        return super().describe() + ":level=" + str(self.level)


class Base:
    def steps(self):
        return ["Base"]


class Left(Base):
    def steps(self):
        return ["Left"] + super().steps()


class Right(Base):
    def steps(self):
        return ["Right"] + super().steps()


class Combined(Left, Right):
    def steps(self):
        return ["Combined"] + super().steps()


def main():
    child = Child("task", 2)
    assert isinstance(child, Parent)
    assert child.describe() == "parent:task:level=2"
    assert Combined().steps() == ["Combined", "Left", "Right", "Base"]
    assert Combined.__mro__ == (Combined, Left, Right, Base, object)
    print(child.describe())
    print(" -> ".join(Combined().steps()))
    print(" -> ".join(cls.__name__ for cls in Combined.__mro__))


if __name__ == "__main__":
    main()
