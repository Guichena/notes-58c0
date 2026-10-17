// Finite reviewed presentation projection. Never edit src/app or entry metadata.
// Apply after display-projection/projectInterviewRuntime; bypass for --baseline-test.
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error('Learner reading runtime: ' + message); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const LEARNER_READING_DISPLAY_ALIASES = freeze({
  "part": {
    "Agent Runtime 工程合同": "Agent Runtime 工程机制",
    "学习参考": "学习指南"
  },
  "cat": {
    "证据、图关系与评价合同": "证据、图关系与评价约束",
    "数据库工具的查询合同": "数据库工具的查询规则",
    "跨册场景补充": "场景分析与追问",
    "实现参考与验证边界": "学习路线与实践条件",
    "查询计划、融合与重排合同": "查询计划、融合与重排约束",
    "向量服务与版本化数据合同": "向量服务与版本化数据契约",
    "教学参考与验证边界": "学习路线与实践条件",
    "补充算法合同": "算法题与解题条件",
    "MySQL 教学参考": "MySQL 学习指南",
    "教学程序与阅读参考": "配套练习与学习指南",
    "身份、隔离与业务状态合同": "身份、隔离与业务状态契约",
    "教学参考与完整代码": "练习环境与完整示例",
    "流处理与数据合同": "流处理与数据约束",
    "完整来源变体": "来源变体与完整解法"
  }
});
export const LEARNER_READING_RUNTIME_AUDIT = freeze({
  "schemaVersion": 1,
  "reviewedAliasRows": 103,
  "distinctDisplayAliases": 16,
  "reviewedAliasRegistrySha256": "c754cb52fb8438983fdfdbd4c6d738b5df7a4fc044d54a77415a5ba104419521",
  "aliasMapSha256": "daadd7ef5689ae336331d44334d9c874ce1aca6e594b3a5618c9f7d5ecaeb93a",
  "applicationOrder": "projectSource -> projectInterviewRuntime -> projectLearnerReadingRuntime",
  "files": [
    {
      "file": "src/app/catalog.js",
      "sourceSha256": "65e514f10ceae1e62b41af467fd812c26937228ced5ef9df37e7e430dc7e969b",
      "resultSha256": "190618b2ecb0a50ae11ed71c45ad71f277a92ccbefebca8c62ef4a9d3f616daf",
      "replacementRules": 1,
      "replacementOccurrences": 1
    },
    {
      "file": "src/app/fragments.js",
      "sourceSha256": "a70ea8ea5c2574cba2d7f6c0e7c8b1dfca7a3a8460cd181167892b712beaa6ae",
      "resultSha256": "1bd0d427615780665f2d31ab797d6a77d30c94f28c4bc676fdda58864a10a1d1",
      "replacementRules": 4,
      "replacementOccurrences": 4
    },
    {
      "file": "src/app/renderers.js",
      "sourceSha256": "6d3627d248010552e9a5a717d3cdffdd778054e04cee40bc8a2a27075f51dd5f",
      "resultSha256": "3b84eaddda67a56804df211417829398756faef568304a55e43775acabb9ca77",
      "replacementRules": 2,
      "replacementOccurrences": 7
    },
    {
      "file": "src/app/highlight-map.js",
      "sourceSha256": "e673d17b135071c4bb87360dd8932fa4f99d7069cf24cbb99e7deffe6381a467",
      "resultSha256": "d767688083e9c59c474c5232d7ca88092e6a56858012f4078495a5e0bef088f2",
      "replacementRules": 3,
      "replacementOccurrences": 4
    },
    {
      "file": "src/app/dashboard.js",
      "sourceSha256": "896ff0b10f56810dc1fd7c27db6b027c71d7acff0701b22dd64c98076102b397",
      "resultSha256": "c4f289b4f086d77f45c53b6085a30933d1ab2340f7d227fdaffa9e4c452d7c2e",
      "replacementRules": 3,
      "replacementOccurrences": 3
    },
    {
      "file": "src/app/navigation.js",
      "sourceSha256": "bb48202e0c71580c7454cc5f5794d0c380b7a9d9864b9c0421f4443c49a6d2d8",
      "resultSha256": "7f3b74237eff55d9b6cf08ee1fa0d7877dd84c31820e5946079684310ed741f0",
      "replacementRules": 3,
      "replacementOccurrences": 3
    },
    {
      "file": "src/app/search.js",
      "sourceSha256": "8976a1310663e5f5f26188eea39171638efaa9141498ce74b68c8c35fa4ec6b7",
      "resultSha256": "139ea2a454c7f2eb6f55a196c2e1c542db2f76c17e40ef7f291b305080d3f3b6",
      "replacementRules": 4,
      "replacementOccurrences": 4
    }
  ],
  "sourceFieldsPreserved": [
    "part",
    "cat",
    "source",
    "id",
    "progressKey",
    "number",
    "items",
    "code",
    "html"
  ],
  "preservedLinks": [
    "e.url",
    "e.slug",
    "it.from.href",
    "entry routes",
    "chapter URLs"
  ],
  "hiddenEditorialChrome": [
    "algorithm e.source chip",
    "scenario e.source chip",
    "handwrite/database e.source chip",
    "QA e.source chip",
    "document e.source footer"
  ],
  "editorialChromeHandling": "Already removed by the prior guarded display projection; verify absence and preserve canonical exercise links.",
  "search": "Preserve raw index; match aliases additionally; display exact entry metadata prefix with aliased part/cat; do not rewrite QA answers or body prose."
});
const RULES = freeze([
  {
    "file": "src/app/catalog.js",
    "sourceSha256": "65e514f10ceae1e62b41af467fd812c26937228ced5ef9df37e7e430dc7e969b",
    "resultSha256": "190618b2ecb0a50ae11ed71c45ad71f277a92ccbefebca8c62ef4a9d3f616daf",
    "replacements": [
      {
        "id": "exact-display-label-helpers",
        "before": "const h = escapeHtml;\n",
        "after": "const h = escapeHtml;\n// Reviewed display labels only. Keep grouping, route, and persistence keys raw.\nconst LEARNER_DISPLAY_ALIASES = Object.freeze({part:Object.freeze({\"Agent Runtime 工程合同\":\"Agent Runtime 工程机制\",\"学习参考\":\"学习指南\"}),cat:Object.freeze({\"证据、图关系与评价合同\":\"证据、图关系与评价约束\",\"数据库工具的查询合同\":\"数据库工具的查询规则\",\"跨册场景补充\":\"场景分析与追问\",\"实现参考与验证边界\":\"学习路线与实践条件\",\"查询计划、融合与重排合同\":\"查询计划、融合与重排约束\",\"向量服务与版本化数据合同\":\"向量服务与版本化数据契约\",\"教学参考与验证边界\":\"学习路线与实践条件\",\"补充算法合同\":\"算法题与解题条件\",\"MySQL 教学参考\":\"MySQL 学习指南\",\"教学程序与阅读参考\":\"配套练习与学习指南\",\"身份、隔离与业务状态合同\":\"身份、隔离与业务状态契约\",\"教学参考与完整代码\":\"练习环境与完整示例\",\"流处理与数据合同\":\"流处理与数据约束\",\"完整来源变体\":\"来源变体与完整解法\"})});\nfunction learnerLabel(field, value) {\n  if (typeof field !== 'string' || typeof value !== 'string') return value;\n  const aliases = Object.hasOwn(LEARNER_DISPLAY_ALIASES, field) ? LEARNER_DISPLAY_ALIASES[field] : null;\n  return aliases && Object.hasOwn(aliases, value) ? aliases[value] : value;\n}\nfunction learnerSearchText(record) {\n  if (record.qi != null || typeof record.text !== 'string') return record.text;\n  const e = record.e;\n  const original = stripTags([e.title, e.number, e.cat, e.part].filter(Boolean).join(' '));\n  const display = stripTags([e.title, e.number, learnerLabel('cat', e.cat), learnerLabel('part', e.part)].filter(Boolean).join(' '));\n  if (!original || original === display) return record.text;\n  if (record.text === original || record.text.startsWith(original + ' ')) return display + record.text.slice(original.length);\n  return record.text;\n}\n",
        "count": 1,
        "beforeSha256": "f285622f465859d70555a2362df44f77b85bd94dbf087be57e69d4b9f4cd852b",
        "afterSha256": "281178988d593b9ad3f5ab2c67860fb5c59df684086c6ebd2e6a8bfc305d458a"
      }
    ]
  },
  {
    "file": "src/app/fragments.js",
    "sourceSha256": "a70ea8ea5c2574cba2d7f6c0e7c8b1dfca7a3a8460cd181167892b712beaa6ae",
    "resultSha256": "1bd0d427615780665f2d31ab797d6a77d30c94f28c4bc676fdda58864a10a1d1",
    "replacements": [
      {
        "id": "breadcrumb-part",
        "before": "h(e.part)",
        "after": "h(learnerLabel('part', e.part))",
        "count": 1,
        "beforeSha256": "82b6a88e88a7f55801d905a2ce40cddcd53e0128c4d37855e25809c0b16cc357",
        "afterSha256": "3bbaa031965557c9001f98410acf97115d2f6c5cb01158cdfea429bee96a7030"
      },
      {
        "id": "breadcrumb-category",
        "before": "h(e.cat)",
        "after": "h(learnerLabel('cat', e.cat))",
        "count": 1,
        "beforeSha256": "8b14904bd68be7ec9c45b571ad190c41e9d043d75457ba625dec79a53051d202",
        "afterSha256": "1fe0dcd8b120f16039cd926a8221139607505e49fdc4358eb920998fe460144c"
      },
      {
        "id": "previous-category",
        "before": "h(prev.cat)",
        "after": "h(learnerLabel('cat', prev.cat))",
        "count": 1,
        "beforeSha256": "bf09b10936be2e5e7bd576ff124e50f4e602c47ac9f2aea3065af13b18299823",
        "afterSha256": "2119b2e3fc9197512aab1254b5953064ac5ed5bb76e7b9579665eb08c18da86f"
      },
      {
        "id": "next-category",
        "before": "h(next.cat)",
        "after": "h(learnerLabel('cat', next.cat))",
        "count": 1,
        "beforeSha256": "7440bd3b0a952bceca81ff65e9f813b3e00a40565a4cc1496ce7813139282de1",
        "afterSha256": "aa2b2a8a7c6b4a1727aa9e6849a55ade381afa208fbf580c513d89f189bbcdf9"
      }
    ]
  },
  {
    "file": "src/app/renderers.js",
    "sourceSha256": "6d3627d248010552e9a5a717d3cdffdd778054e04cee40bc8a2a27075f51dd5f",
    "resultSha256": "3b84eaddda67a56804df211417829398756faef568304a55e43775acabb9ca77",
    "replacements": [
      {
        "id": "topic-category-title",
        "before": "title:e.cat,",
        "after": "title:learnerLabel('cat', e.cat),",
        "count": 1,
        "beforeSha256": "2af7c7e0a001036078e8f114b14e0e80f3e946d6a444efd926932bef71c882bb",
        "afterSha256": "53e809f721fa96780f5c72a572d66dafdab192546e50a2bfbd6dff07d4c98e21"
      },
      {
        "id": "entry-category-chips",
        "before": "h(e.cat)",
        "after": "h(learnerLabel('cat', e.cat))",
        "count": 6,
        "beforeSha256": "8b14904bd68be7ec9c45b571ad190c41e9d043d75457ba625dec79a53051d202",
        "afterSha256": "1fe0dcd8b120f16039cd926a8221139607505e49fdc4358eb920998fe460144c"
      }
    ]
  },
  {
    "file": "src/app/highlight-map.js",
    "sourceSha256": "e673d17b135071c4bb87360dd8932fa4f99d7069cf24cbb99e7deffe6381a467",
    "resultSha256": "d767688083e9c59c474c5232d7ca88092e6a56858012f4078495a5e0bef088f2",
    "replacements": [
      {
        "id": "map-part-headings",
        "before": "h(p.name)",
        "after": "h(learnerLabel('part', p.name))",
        "count": 2,
        "beforeSha256": "b9d35a6bb5fd9c4112fb6e6169349d8f81a579a1e02b5750afea5f7f0aa517ad",
        "afterSha256": "be42eca796753a0d58fdebd807f5f463146850a13122c423be22a9cf0432ddbc"
      },
      {
        "id": "map-category-toc",
        "before": "<span class=\"t\">${h(c.name)}</span>",
        "after": "<span class=\"t\">${h(learnerLabel('cat', c.name))}</span>",
        "count": 1,
        "beforeSha256": "b722370a85ec041e44946951b2742bc0bbcf0266db9dc5d2cebbc3e3f9a36679",
        "afterSha256": "09ac8663863a69452c1948a3ac686e9d51d7d2ec7366f87644bad66d8f8273bb"
      },
      {
        "id": "map-category-heading",
        "before": "<span class=\"t\"><b>${h(c.name)}</b>",
        "after": "<span class=\"t\"><b>${h(learnerLabel('cat', c.name))}</b>",
        "count": 1,
        "beforeSha256": "98202f3006ef7d26ded45b1047d9753a665e41176f336342cd8e78f9c96b10b4",
        "afterSha256": "dd2ee17aef42ffbbbfea6a116c8d73f8508b0898910424d8ae42d7347a9e20a7"
      }
    ]
  },
  {
    "file": "src/app/dashboard.js",
    "sourceSha256": "896ff0b10f56810dc1fd7c27db6b027c71d7acff0701b22dd64c98076102b397",
    "resultSha256": "c4f289b4f086d77f45c53b6085a30933d1ab2340f7d227fdaffa9e4c452d7c2e",
    "replacements": [
      {
        "id": "recent-entry-category",
        "before": "h(last.cat)",
        "after": "h(learnerLabel('cat', last.cat))",
        "count": 1,
        "beforeSha256": "b89c86b8bb4c3e1dd592a6d18dc12d31fd2ddb6f0f34c38051f538a048a7ee05",
        "afterSha256": "60072609c2be4e319cf08af306fdf42a0c79ac8fa6aeb3b38dfd4d2e72488e43"
      },
      {
        "id": "module-part-heading",
        "before": "h(p.name)",
        "after": "h(learnerLabel('part', p.name))",
        "count": 1,
        "beforeSha256": "b9d35a6bb5fd9c4112fb6e6169349d8f81a579a1e02b5750afea5f7f0aa517ad",
        "afterSha256": "be42eca796753a0d58fdebd807f5f463146850a13122c423be22a9cf0432ddbc"
      },
      {
        "id": "module-category-card",
        "before": "h(c.name)",
        "after": "h(learnerLabel('cat', c.name))",
        "count": 1,
        "beforeSha256": "4787fc619f816939174ee643155a49c86b9d6f202ac7e9d2850fd2473a58a61d",
        "afterSha256": "a921cb89290cca4f68093613bce56b4091161a534c80f1e35cd692caf0287e92"
      }
    ]
  },
  {
    "file": "src/app/navigation.js",
    "sourceSha256": "bb48202e0c71580c7454cc5f5794d0c380b7a9d9864b9c0421f4443c49a6d2d8",
    "resultSha256": "7f3b74237eff55d9b6cf08ee1fa0d7877dd84c31820e5946079684310ed741f0",
    "replacements": [
      {
        "id": "sidebar-category-heading",
        "before": "h(c.name)",
        "after": "h(learnerLabel('cat', c.name))",
        "count": 1,
        "beforeSha256": "4787fc619f816939174ee643155a49c86b9d6f202ac7e9d2850fd2473a58a61d",
        "afterSha256": "a921cb89290cca4f68093613bce56b4091161a534c80f1e35cd692caf0287e92"
      },
      {
        "id": "sidebar-part-heading",
        "before": "h(p.name)",
        "after": "h(learnerLabel('part', p.name))",
        "count": 1,
        "beforeSha256": "b9d35a6bb5fd9c4112fb6e6169349d8f81a579a1e02b5750afea5f7f0aa517ad",
        "afterSha256": "be42eca796753a0d58fdebd807f5f463146850a13122c423be22a9cf0432ddbc"
      },
      {
        "id": "sidebar-alias-matching",
        "before": "`${e.title} ${e.number} ${e.cat}`",
        "after": "`${e.title} ${e.number} ${e.cat} ${learnerLabel('cat', e.cat)} ${learnerLabel('part', e.part)}`",
        "count": 1,
        "beforeSha256": "05d152b67223138f604613c4200a5e97dec453567df6363c649030dcbe71a61a",
        "afterSha256": "9f25a8053cc1c7e58461f7298222ce7b80c47aac7ac35e8ab7ab2046f9af2e71"
      }
    ]
  },
  {
    "file": "src/app/search.js",
    "sourceSha256": "8976a1310663e5f5f26188eea39171638efaa9141498ce74b68c8c35fa4ec6b7",
    "resultSha256": "139ea2a454c7f2eb6f55a196c2e1c542db2f76c17e40ef7f291b305080d3f3b6",
    "replacements": [
      {
        "id": "search-result-category",
        "before": "  const sub = isQ ? `${e.cat} · ${e.title}` : `${KIND_LABEL[e.kind] || ''} · ${e.cat}`;",
        "after": "  const sub = isQ ? `${learnerLabel('cat', e.cat)} · ${e.title}` : `${KIND_LABEL[e.kind] || ''} · ${learnerLabel('cat', e.cat)}`;",
        "count": 1,
        "beforeSha256": "c2485eb93a90e2563f0097d26a199b05e7ce35c00dffdf097ef9c4d69afcafba",
        "afterSha256": "ad7fb50e6a920a3c4a21918cdd4c24b531b2bace399717860548bcd3c3b48489"
      },
      {
        "id": "search-snippet-exact-structural-prefix",
        "before": "  const snip = terms.length && r.text ? snippet(r.text, terms) : '';",
        "after": "  const snip = terms.length && r.text ? snippet(learnerSearchText(r), terms) : '';",
        "count": 1,
        "beforeSha256": "784de2e833f94773e3fc5e50a8ec5681624442c1af40045da825d8fc7af55676",
        "afterSha256": "bb64f78448ffa5450495411175c8c62cad159ce844c94fdd7c827404e6b40d69"
      },
      {
        "id": "search-alias-labels",
        "before": "    let score = 0, ok = true;",
        "after": "    const labels = (learnerLabel('part', r.e.part) + ' ' + learnerLabel('cat', r.e.cat)).toLowerCase();\n    let score = 0, ok = true;",
        "count": 1,
        "beforeSha256": "efe0c558622a1f21e4382709c31250eb42199c794f48d842d555a0cdbda0bbf1",
        "afterSha256": "26511e1e2651c3a1065ea0bdd6662613e948a6a823da99281716669eaa861e9f"
      },
      {
        "id": "search-alias-matching",
        "before": "      else if (r.tx.includes(t)) score += 1;",
        "after": "      else if (r.tx.includes(t) || labels.includes(t)) score += 1;",
        "count": 1,
        "beforeSha256": "3519f94d0988f88857ed34c47ac5b77d3c56993e100843da2014f41b1832374c",
        "afterSha256": "d9468a92e40d43daa1940c3585464bf21b8d65a0925d23c8ed9759452fee61b7"
      }
    ]
  }
]);
function validateRegistry() {
  if (sha(JSON.stringify(LEARNER_READING_DISPLAY_ALIASES)) !== LEARNER_READING_RUNTIME_AUDIT.aliasMapSha256) fail('alias map hash mismatch');
  if (RULES.length !== LEARNER_READING_RUNTIME_AUDIT.files.length) fail('runtime file count mismatch');
  const seenFiles = new Set();
  for (const rule of RULES) {
    if (seenFiles.has(rule.file) || !/^src\/app\/(catalog|fragments|renderers|highlight-map|dashboard|navigation|search)\.js$/.test(rule.file)) fail('invalid or duplicate runtime file ' + rule.file);
    seenFiles.add(rule.file);
    const seenRules = new Set();
    for (const replacement of rule.replacements) {
      if (seenRules.has(replacement.id)) fail('duplicate replacement ' + rule.file + '/' + replacement.id);
      seenRules.add(replacement.id);
      if (typeof replacement.before !== 'string' || !replacement.before || typeof replacement.after !== 'string' || !Number.isInteger(replacement.count) || replacement.count < 1) fail('invalid replacement ' + replacement.id);
      if (sha(replacement.before) !== replacement.beforeSha256 || sha(replacement.after) !== replacement.afterSha256) fail('replacement hash mismatch ' + replacement.id);
    }
  }
}
validateRegistry();
export function projectLearnerReadingRuntime(file, text, {baselineTest = false} = {}) {
  if (baselineTest) return text;
  const rule = RULES.find(rule => rule.file === file);
  if (!rule) return text;
  if (typeof text !== 'string' || sha(text) !== rule.sourceSha256) fail('source hash mismatch ' + file);
  let result = text;
  for (const replacement of rule.replacements) {
    const occurrences = result.split(replacement.before).length - 1;
    if (occurrences !== replacement.count) fail('anchor count mismatch ' + file + '/' + replacement.id);
    result = result.split(replacement.before).join(replacement.after);
  }
  if (sha(result) !== rule.resultSha256) fail('result hash mismatch ' + file);
  return result;
}
