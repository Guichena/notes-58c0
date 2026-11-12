// System-design lectures → site entries.
//
// Two shapes, decided by the user: lectures that describe one concrete system
// are merged into that system's scenario page as its knowledge section; lectures
// about method, architecture and component governance become their own pages.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {mdToSiteHtml, firstParagraph} from './md-lite.mjs';

const SOURCE = '系统设计面试学习资料';

// mode 'merge' attaches the lecture to an existing scenario page.
// mode 'page' creates a new scenario page (a question) from the lecture.
// mode 'doc' creates a standalone 设计思想与架构 page.
export const LECTURES = [
  {file: '00_系统设计方法与容量估算.md', id: 'sd-method', mode: 'doc', cat: '方法与容量',
    title: '系统设计方法与容量估算：需求澄清、不变量、容量与故障模型'},
  {file: '01_登录功能.md', id: 'sd-login', mode: 'page', cat: '登录与安全',
    title: '登录系统设计（会话、JWT、MFA 与登录限流）',
    idea: '先把会话载体、令牌生命周期、多端登录和风控分开定，再谈接口；四件事任何一件没定，后面的实现都会返工。',
    metrics: '登录 QPS、在线会话数、令牌刷新频率、短信发送量与限流阈值',
    components: '接入网关、认证服务、会话存储、短信与风控、第三方 IdP'},
  {file: '02_秒杀系统.md', id: 'sd-seckill', mode: 'merge', target: 'scenario-seckill-system'},
  {file: '03_实时聊天与实时弹幕.md', id: 'sd-chat', mode: 'merge', target: 'scenario-live-comment-system'},
  {file: '04_定时任务.md', id: 'sd-schedule', mode: 'merge', target: 'scenario-distributed-scheduler'},
  {file: '05_排行榜.md', id: 'sd-ranking', mode: 'merge', target: 'scenario-realtime-music-ranking'},
  {file: '06_文件与视频流传输.md', id: 'sd-file-video', mode: 'page', cat: '实时、内容与推送',
    title: '文件上传下载与视频流传输设计',
    idea: '元数据与内容分开存：分块上传、断点续传、校验、转码和流式播放是五件事，各自有不同的失败边界。',
    metrics: '单文件大小、上传并发、首帧时间、播放卡顿率、回源带宽',
    components: '对象存储、上传网关、转码集群、CDN、元数据库、播放器'},
  {file: '07_朋友圈与微信运动.md', id: 'sd-feed', mode: 'merge', target: 'scenario-feed-system'},
  {file: '08_点赞系统.md', id: 'sd-like', mode: 'page', cat: '实时、内容与推送',
    title: '点赞系统设计（状态、计数与事件传播）',
    idea: '用户状态、显示计数和事件传播是三件事：关系表定语义，计数投影扛读，事件表保证传播可重放。',
    metrics: '点赞写入 QPS、计数读取 QPS、热点对象单 key 写入、对账差异条数',
    components: '点赞服务、关系表、计数分桶、Outbox 与消息队列、对账任务'},
  {file: '09_评论系统.md', id: 'sd-comment', mode: 'page', cat: '实时、内容与推送',
    title: '评论系统设计（树结构、审核、分页与可见性）',
    idea: '评论是树结构加审核加分页：先定删除与可见性语义，再定存储与热评缓存，最后才谈分页算法。',
    metrics: '评论写入 QPS、单页拉取耗时、热评命中率、审核积压',
    components: '评论服务、评论表与索引、审核队列、热评缓存、通知服务'},
  {file: '10_Redis大key与热key.md', id: 'sd-redis-bigkey', mode: 'doc', cat: '存储与中间件',
    title: 'Redis 大 key 与热 key：识别、拆分、删除与热读热写治理'},
  {file: '11_海量数据存储与分库分表.md', id: 'sd-sharding', mode: 'doc', cat: '存储与中间件',
    title: '海量数据存储与分库分表：分片、索引、CDC 与在线迁移'},
  {file: '12_消息队列场景.md', id: 'sd-mq', mode: 'merge', target: 'scenario-message-queue'},
  {file: '13_MySQL调优.md', id: 'sd-mysql-tuning', mode: 'doc', cat: '存储与中间件',
    title: 'MySQL 调优：索引、锁、MVCC、复制与慢查询'},
  {file: '14_跨模块资源控制与故障推演.md', id: 'sd-cross-module', mode: 'doc', cat: '分布式与治理',
    title: '跨模块资源控制与故障推演：线程、连接、幂等与恢复'},
  {file: '15_连续追问与知识点索引.md', id: 'sd-followup', mode: 'doc', cat: '索引与练习',
    title: '系统设计连续追问与知识点索引'},
  {file: '16_非功能设计与容量规划.md', id: 'sd-nonfunctional', mode: 'doc', cat: '方法与容量',
    title: '非功能设计与容量规划：大数据量、高并发、慢接口与 SLO'},
  {file: '17_微服务与全链路治理.md', id: 'sd-microservice', mode: 'doc', cat: '分布式与治理',
    title: '微服务与全链路治理：拆分、灰度、隔离、截止预算与分布式事务'},
  {file: '18_MySQL查询事务与在线迁移.md', id: 'sd-mysql-migration', mode: 'doc', cat: '存储与中间件',
    title: 'MySQL 查询、事务与在线迁移：慢查询、死锁、MDL 与回切'},
  {file: '19_Redis缓存与排行榜.md', id: 'sd-redis-ranking', mode: 'merge', target: 'scenario-redis-mysql-consistency'},
  {file: '20_Kafka可靠性与积压治理.md', id: 'sd-kafka', mode: 'doc', cat: '存储与中间件',
    title: 'Kafka 业务可靠性、顺序与积压治理'},
  {file: '21_知识点索引与综合面试练习.md', id: 'sd-knowledge-index', mode: 'doc', cat: '索引与练习',
    title: '系统设计知识点索引与综合面试练习'},
  {file: '22_海量数据与受限内存算法.md', id: 'sd-memory-algo', mode: 'doc', cat: '存储与中间件',
    title: '海量数据与受限内存算法：位图、分桶与外排'},
  {file: '23_高并发准入与分布式锁.md', id: 'sd-admission-lock', mode: 'merge', target: 'scenario-distributed-lock'},
  {file: '24_慢接口诊断与线程连接预算.md', id: 'sd-slow-api', mode: 'doc', cat: '分布式与治理',
    title: '慢接口诊断与线程连接预算：索引、分页、并行与 JVM'},
  {file: '25_高可用与容灾恢复.md', id: 'sd-ha-dr', mode: 'doc', cat: '分布式与治理',
    title: '高可用与容灾恢复：主从、多活写权、跨存储恢复与演练'},
  {file: '参考文献.md', id: 'sd-references', mode: 'doc', cat: '索引与练习',
    title: '参考文献与资料出处'}
];

const DOC_PART = '设计思想与架构';

export async function mergeDesignLectures(entries, dir) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const added = [];
  const missingTargets = [];
  for (const item of LECTURES) {
    const markdown = await readFile(path.join(dir, item.file), 'utf8');
    const {html, toc} = mdToSiteHtml(markdown, {idPrefix: item.id});
    if (item.mode === 'merge') {
      const target = byId.get(item.target);
      if (!target) { missingTargets.push(item.target); continue; }
      target.knowledgeHtml = html;
      target.knowledgeToc = toc;
      target.knowledgeSource = item.file.replace(/\.md$/, '').replace(/^\d+_/, '');
      continue;
    }
    if (item.mode === 'page') {
      const entry = {
        id: item.id,
        kind: 'scenario',
        mod: 'design',
        part: '架构场景 35 题',
        cat: item.cat,
        title: item.title,
        number: '',
        source: SOURCE,
        idea: item.idea,
        description: firstParagraph(markdown),
        metrics: item.metrics,
        components: item.components,
        knowledgeHtml: html,
        knowledgeToc: toc,
        knowledgeSource: item.file.replace(/\.md$/, '').replace(/^\d+_/, '')
      };
      entries.push(entry);
      byId.set(entry.id, entry);
      added.push(entry.id);
      continue;
    }
    const entry = {
      id: item.id,
      kind: 'doc',
      mod: 'design',
      part: DOC_PART,
      cat: item.cat,
      title: item.title,
      number: '',
      source: SOURCE,
      lead: firstParagraph(markdown).slice(0, 220),
      html
    };
    entries.push(entry);
    byId.set(entry.id, entry);
    added.push(entry.id);
  }
  if (missingTargets.length) throw new Error('Design lectures: unknown merge target ' + missingTargets.join(', '));
  return {entries, added};
}
