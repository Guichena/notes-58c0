"""Bounded CPython 3.12.14 semantic/storage observations; no timing claims."""
import json
import platform
import struct
import sys
import unittest


class CollisionKey:
    comparisons = 0

    def __init__(self, value):
        self.value = value

    def __hash__(self):
        return 7

    def __eq__(self, other):
        type(self).comparisons += 1
        if not isinstance(other, CollisionKey):
            return NotImplemented
        return self.value == other.value


class ContainerTests(unittest.TestCase):
    def test_list_growth_keeps_object_and_referents(self):
        items = []
        empty_size = items.__sizeof__()
        pointer_size = struct.calcsize("P")
        list_identity = id(items)
        marker = object()
        growth = []
        last_capacity = 0
        for size in range(1, 513):
            items.append(marker)
            capacity = (items.__sizeof__() - empty_size) // pointer_size
            self.assertGreaterEqual(capacity, size)
            self.assertEqual(id(items), list_identity)
            self.assertIs(items[-1], marker)
            if capacity != last_capacity:
                growth.append(capacity)
                last_capacity = capacity
        self.assertEqual(growth[:8], [4, 8, 16, 24, 32, 40, 52, 64])
        print("list_capacity_prefix=" + json.dumps(growth[:8]))

    def test_list_insert_delete_and_shallow_copy(self):
        nested = [1]
        items = [nested, 2, 3]
        clone = items[:]
        self.assertIsNot(clone, items)
        self.assertIs(clone[0], nested)
        items.insert(1, 9)
        self.assertEqual(items.pop(1), 9)
        self.assertEqual(items, [nested, 2, 3])

    def test_tuple_slots_fixed_but_referents_mutable(self):
        nested = []
        record = (nested, 2)
        nested.append(1)
        self.assertEqual(record[0], [1])
        with self.assertRaises(TypeError):
            record[0] = []
        with self.assertRaises(TypeError):
            hash(record)
        self.assertEqual({(1, 2): "ok"}[(1, 2)], "ok")

    def test_tuple_pointer_array_size(self):
        empty_size = ().__sizeof__()
        pointer_size = struct.calcsize("P")
        for size in (1, 2, 8, 32, 128):
            value = tuple(range(size))
            self.assertEqual(value.__sizeof__() - empty_size,
                             size * pointer_size)

    def test_dict_collisions_deletions_and_equal_keys(self):
        size = 128
        mapping = {CollisionKey(i): i for i in range(size)}
        self.assertEqual(len(mapping), size)
        self.assertEqual(mapping[CollisionKey(100)], 100)
        del mapping[CollisionKey(64)]
        self.assertEqual(mapping[CollisionKey(127)], 127)
        mapping[CollisionKey(100)] = "updated"
        self.assertEqual(len(mapping), size - 1)
        self.assertEqual(mapping[CollisionKey(100)], "updated")
        CollisionKey.comparisons = 0
        self.assertNotIn(CollisionKey(-1), mapping)
        compared = CollisionKey.comparisons
        self.assertGreaterEqual(compared, size - 1)
        self.assertLess(compared, 4 * size)
        print("colliding_missing_lookup_comparisons=" + str(compared))

    def test_dict_order_update_then_reinsert(self):
        mapping = {"a": 1, "b": 2, "c": 3}
        mapping["b"] = 20
        self.assertEqual(list(mapping), ["a", "b", "c"])
        del mapping["b"]
        mapping["b"] = 2
        self.assertEqual(list(mapping), ["a", "c", "b"])

    def test_dict_storage_changes_are_not_deep_size(self):
        mapping = {}
        sizes = {mapping.__sizeof__()}
        for value in range(512):
            mapping[value] = value
            sizes.add(mapping.__sizeof__())
        self.assertGreater(len(sizes), 1)
        self.assertEqual(len(mapping), 512)
        small = {"payload": b"x"}
        large = {"payload": b"x" * 100_000}
        self.assertEqual(sys.getsizeof(small), sys.getsizeof(large))
        print("dict_observed_storage_sizes=" + json.dumps(sorted(sizes)))

    def test_set_deduplicates_equal_not_merely_same_hash(self):
        values = {CollisionKey(1), CollisionKey(2), CollisionKey(1)}
        self.assertEqual(len(values), 2)
        self.assertIn(CollisionKey(2), values)
        self.assertEqual(len({1, True, 1.0}), 1)


if __name__ == "__main__":
    if platform.python_implementation() != "CPython":
        raise SystemExit("This observation program requires CPython")
    if sys.version_info[:3] != (3, 12, 14):
        raise SystemExit("This frozen observation program requires CPython 3.12.14")
    print("runtime=" + sys.version.replace("\n", " "), flush=True)
    unittest.main(verbosity=2)
