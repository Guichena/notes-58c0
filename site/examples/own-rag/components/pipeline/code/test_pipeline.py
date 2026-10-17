"""Self-contained numerical/request/schema checks; no network, database service or FAISS execution."""
import importlib.util
import json
import math
from pathlib import Path
import random
import sqlite3
import struct
import sys
import unittest

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent

def module(name):
    spec=importlib.util.spec_from_file_location(name, ROOT/(name+'.py'))
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod

hp=module('half_precision');vb=module('vector_batches');fx=module('faiss_example')

class PipelineTest(unittest.TestCase):
    def test_half(self):
        values=[0.,-0.,65504.,-65504.,2**-14,2**-24]
        self.assertEqual(hp.decode(hp.encode(values),len(values)),tuple(values))
        self.assertEqual(len(hp.encode(values)),12)
        self.assertEqual(hp.decode(hp.encode([2**-30]),1),(0.,))
        for values in [[],[math.nan],[math.inf],[65505.]]:
            with self.assertRaises(ValueError):hp.encode(values)
        with self.assertRaises(ValueError):hp.decode(b'\0',1)
        with self.assertRaises(ValueError):hp.decode(struct.pack('>e',math.inf),1)
        with self.assertRaises(ValueError):hp.cosine([0.],[1.])
        for a,b,want in [([1e308,1e308],[1.,1.],1),([5e-324],[1.],1),([1.,0.],[0.,1.],0),([1e-308],[-1e308],-1)]:
            self.assertAlmostEqual(hp.cosine(a,b),want)
        rng=random.Random(603)
        for d in (512,1024):
            for _ in range(100):
                a=[rng.uniform(-1,1) for _ in range(d)];decoded=hp.decode(hp.encode(a),d)
                self.assertGreater(hp.cosine(a,decoded),.999999)
    def test_batches(self):
        rows=[{'id':str(i),'vector':[float(i),1.],'text':'中文'} for i in range(21)]
        groups=list(vb.batches(iter(rows),2,3,300))
        self.assertEqual([json.loads(b) for g in groups for b in g],rows)
        self.assertTrue(all(len(g)<=3 and sum(map(len,g))<=300 for g in groups))
        self.assertEqual(len(list(vb.batches([rows[0],rows[0]],2,9,300))),2)
        for row in [{'id':'','vector':[1,2]},{'id':'x','vector':[math.nan,1]},{'id':'x','vector':[True,1]},{'id':'x','vector':[1]},{'id':'x','vector':[10**999,1]}]:
            with self.assertRaises(ValueError):list(vb.batches([row],2))
        with self.assertRaises(ValueError):list(vb.batches(rows,2,1,1))
        original={'id':'x','vector':[1,2]}; group=list(vb.batches([original],2))[0];original['vector'][0]=9
        self.assertEqual(json.loads(group[0])['vector'][0],1)
        for args in [(True,1,1),(2,0,100),(2,1,False)]:
            with self.assertRaises(ValueError):list(vb.batches([],args[0],args[1],args[2]))
    def test_batch_identity_is_frozen_across_yield(self):
        rows=[{'id':'A','vector':[1.]},{'id':'A','vector':[2.]},{'id':'A','vector':[3.]}]
        stream=vb.batches(rows,1,max_items=10,max_bytes=10000)
        self.assertEqual([json.loads(x)['id'] for x in next(stream)],['A'])
        rows[1]['id']='B'  # The second record was already encoded before the yield.
        self.assertEqual([[json.loads(x)['id'] for x in group] for group in stream],[['A'],['A']])
    def test_numpy_preparation(self):
        import numpy as np
        a=fx.normalized_matrix([[1e308,1e308],[5e-324,0.]],2)
        self.assertEqual(a.dtype,np.float32);self.assertTrue(a.flags.c_contiguous)
        np.testing.assert_allclose(np.linalg.norm(a,axis=1),[1,1],rtol=1e-6)
        for rows,d in [([[0.,0.]],2),([[math.nan,1.]],2),([[1.]],2),([],2),([[1.]],True)]:
            with self.assertRaises(ValueError):fx.normalized_matrix(rows,d)
        for ids,n in [([1,1],2),([-1],1),([1.],1),([True],1),([2**64-1],1)]:
            with self.assertRaises(ValueError):fx.stable_ids(ids,n)
        self.assertEqual(fx.stable_ids([1,2],2).tolist(),[1,2])
    def test_news_constraints(self):
        db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON');db.executescript((ROOT/'news_schema.sql').read_text())
        db.execute("INSERT INTO news_article VALUES(1,1,'s','a','u','t','c','zh','2026-01-01','2026-01-02','license')")
        db.execute("INSERT INTO news_revision VALUES(1,1,1,'obj','hash','ready')")
        db.execute("INSERT INTO news_chunk VALUES(1,1,1,1,'body',0,5,'hash')")
        db.execute("INSERT INTO news_embedding VALUES(1,1,1,1,'model',3,'cosine','g','id')")
        bad=["INSERT INTO news_article VALUES(1,2,'s','a','u','t','c','zh','a','b','l')",
             "INSERT INTO news_chunk VALUES(2,1,1,1,'body',0,5,'hash')",
             "INSERT INTO news_chunk VALUES(1,1,2,1,'body',0,5,'hash')",
             "INSERT INTO news_chunk VALUES(1,1,1,2,'body',5,0,'hash')",
             "INSERT INTO news_embedding VALUES(1,1,1,1,'m2',0,'cosine','g','id2')"]
        for sql in bad:
            with self.assertRaises(sqlite3.IntegrityError):db.execute(sql)
        db.close()
    def test_retrieval_constraints(self):
        db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON')
        ddl,query=(ROOT/'retrieval_schema.sql').read_text().split('-- Model-selected',1)
        db.executescript(ddl)
        query=query[query.index('SELECT ch.chunk_id'):]
        db.execute("INSERT INTO kb_document VALUES(1,1,1,'u','h',1)")
        db.execute("INSERT INTO kb_table VALUES(1,1,1,1,'t','{}',2)")
        db.execute("INSERT INTO kb_acl VALUES(1,1,1,9)")
        db.execute("INSERT INTO kb_chunk VALUES(1,1,1,1,1,0,2,'body','h')")
        self.assertEqual(db.execute(query,(1,9,1,1,1)).fetchall(),[(1,'body')])
        self.assertEqual(db.execute(query,(2,9,1,1,1)).fetchall(),[])
        for sql in ["INSERT INTO kb_chunk VALUES(2,1,1,1,1,0,2,'body','h')",
                    "INSERT INTO kb_chunk VALUES(1,1,1,2,1,NULL,2,'body','h')",
                    "INSERT INTO kb_chunk VALUES(1,1,1,2,2,0,2,'body','h')",
                    "INSERT INTO kb_relation VALUES(1,1,1,1,1,2,'a','b','N:1',1,'p')"]:
            with self.assertRaises(sqlite3.IntegrityError):db.execute(sql)
        db.execute('DELETE FROM kb_acl WHERE principal_id=9')
        self.assertEqual(db.execute(query,(1,9,1,1,1)).fetchall(),[]);db.close()

if __name__=='__main__':unittest.main(verbosity=2)
