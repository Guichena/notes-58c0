"""Minimal metadata/registration example, not an ORM or database adapter."""
class Field:
    def __init__(self, column):
        self.column = column

class ModelMeta(type):
    registry = {}

    def __new__(mcls, name, bases, namespace, **kwargs):
        fields = {}
        for base in reversed(bases):
            fields.update(getattr(base, '__fields__', {}))
        fields.update({key: value for key, value in namespace.items()
                       if isinstance(value, Field)})
        namespace['__fields__'] = fields
        # Pass the original namespace, including any __classcell__, to type.
        cls = super().__new__(mcls, name, bases, namespace, **kwargs)
        if not namespace.get('__abstract__', False):
            mcls.registry[name] = cls
        return cls

class Model(metaclass=ModelMeta):
    __abstract__ = True
    id = Field('id')

    def label(self):
        return 'model'

class User(Model):
    name = Field('user_name')

    def label(self):
        return super().label() + ':user'

# One-argument type inspects a type; three-argument type creates a class.
Point = type('Point', (object,), {'unit': 'm', '__module__': __name__})
assert type(Point()) is Point
assert Point.unit == 'm'
assert type(User) is ModelMeta and isinstance(User(), Model)
assert ModelMeta.registry['User'] is User and 'Model' not in ModelMeta.registry
assert set(User.__fields__) == {'id', 'name'}
assert User.__fields__['name'].column == 'user_name'
assert set(Model.__fields__) == {'id'}  # child metadata does not mutate parent
assert User().label() == 'model:user'  # __classcell__ preserved
print('PASS: dynamic type, metaclass identity, inherited metadata, registry, super')
