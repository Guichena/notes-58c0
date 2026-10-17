// Render only the existing capacity-estimation string-array field; leave all data untouched.
export function renderCapacityEstimationPitfalls(value) {
 if (!Array.isArray(value) || !value.length || !value.every(x => typeof x === 'string')) return '';
 return '<div class="panel tone-warn" data-capacity-pitfalls><h4>容量估算常见误区</h4>' + bullets(value) + '</div>';
}
export function projectCapacityPitfallsRuntime(file,text,{baselineTest=false}={}) {
 if (baselineTest || file !== 'src/app/renderers.js') return text;
 const before = "    + (e.capacityEstimation.benchmarks ? `<div class=\"tbl-wrap\"><table class=\"tbl\"><thead><tr><th>资源</th><th>写</th><th>读</th><th>备注</th></tr></thead><tbody>${e.capacityEstimation.benchmarks.map((b) => `<tr><td>${h(b.resource)}</td><td>${h(b.write)}</td><td>${h(b.read)}</td><td>${h(b.note)}</td></tr>`).join('')}</tbody></table></div>` : '')));";
 if (text.split(before).length !== 2) throw Error('Capacity pitfalls display: expected exactly one capacity table render site');
 const after = before.slice(0,-3) + ' + renderCapacityEstimationPitfalls(e.capacityEstimation.pitfalls)));';
 return text.replace(before,after) + '\n' + renderCapacityEstimationPitfalls.toString() + '\n';
}
