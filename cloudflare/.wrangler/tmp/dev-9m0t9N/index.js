var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) =>
  __defProp(target, 'name', { value, configurable: true });
var __esm = (fn, res) =>
  function __init() {
    return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
  };
var __commonJS = (cb, mod) =>
  function __require() {
    return (
      mod ||
        (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
      mod.exports
    );
  };
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === 'object') || typeof from === 'function') {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, 'default', { value: mod, enumerable: true })
      : target,
    mod
  )
);

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, 'fn');
  return Object.assign(fn, { __unenv__: true });
}
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
var init_utils = __esm({
  'node_modules/unenv/dist/runtime/_internal/utils.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(createNotImplementedError, 'createNotImplementedError');
    __name(notImplemented, 'notImplemented');
    __name(notImplementedClass, 'notImplementedClass');
  },
});

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin,
  _performanceNow,
  nodeTiming,
  PerformanceEntry,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceResourceTiming,
  PerformanceObserverEntryList,
  Performance,
  PerformanceObserver,
  performance;
var init_performance = __esm({
  'node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now
      ? globalThis.performance.now.bind(globalThis.performance)
      : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: 'node',
      entryType: 'node',
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0,
      },
      detail: void 0,
      toJSON() {
        return this;
      },
    };
    PerformanceEntry = class {
      static {
        __name(this, 'PerformanceEntry');
      }
      __unenv__ = true;
      detail;
      entryType = 'event';
      name;
      startTime;
      constructor(name, options3) {
        this.name = name;
        this.startTime = options3?.startTime || _performanceNow();
        this.detail = options3?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail,
        };
      }
    };
    PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
      static {
        __name(this, 'PerformanceMark');
      }
      entryType = 'mark';
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    };
    PerformanceMeasure = class extends PerformanceEntry {
      static {
        __name(this, 'PerformanceMeasure');
      }
      entryType = 'measure';
    };
    PerformanceResourceTiming = class extends PerformanceEntry {
      static {
        __name(this, 'PerformanceResourceTiming');
      }
      entryType = 'resource';
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = '';
      name = '';
      nextHopProtocol = '';
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    PerformanceObserverEntryList = class {
      static {
        __name(this, 'PerformanceObserverEntryList');
      }
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    Performance = class {
      static {
        __name(this, 'Performance');
      }
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError('Performance.timerify');
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming('');
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName
          ? this._entries.filter((e) => e.name !== markName)
          : this._entries.filter((e) => e.entryType !== 'mark');
      }
      clearMeasures(measureName) {
        this._entries = measureName
          ? this._entries.filter((e) => e.name !== measureName)
          : this._entries.filter((e) => e.entryType !== 'measure');
      }
      clearResourceTimings() {
        this._entries = this._entries.filter(
          (e) => e.entryType !== 'resource' || e.entryType !== 'navigation'
        );
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter(
          (e) => e.name === name && (!type || e.entryType === type)
        );
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options3) {
        const entry = new PerformanceMark(name, options3);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === 'string') {
          start = this.getEntriesByName(startOrMeasureOptions, 'mark')[0]
            ?.startTime;
          end = this.getEntriesByName(endMark, 'mark')[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end,
          },
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options3) {
        throw createNotImplementedError('Performance.addEventListener');
      }
      removeEventListener(type, listener, options3) {
        throw createNotImplementedError('Performance.removeEventListener');
      }
      dispatchEvent(event) {
        throw createNotImplementedError('Performance.dispatchEvent');
      }
      toJSON() {
        return this;
      }
    };
    PerformanceObserver = class {
      static {
        __name(this, 'PerformanceObserver');
      }
      __unenv__ = true;
      static supportedEntryTypes = [];
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError('PerformanceObserver.disconnect');
      }
      observe(options3) {
        throw createNotImplementedError('PerformanceObserver.observe');
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    performance =
      globalThis.performance && 'addEventListener' in globalThis.performance
        ? globalThis.performance
        : new Performance();
  },
});

// node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  'node_modules/unenv/dist/runtime/node/perf_hooks.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_performance();
  },
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  'node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs'() {
    init_perf_hooks();
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  },
});

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default;
var init_noop = __esm({
  'node_modules/unenv/dist/runtime/mock/noop.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    noop_default = Object.assign(() => {}, { __unenv__: true });
  },
});

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from 'node:stream';
var _console,
  _ignoreErrors,
  _stderr,
  _stdout,
  log,
  info,
  trace,
  debug,
  table,
  error,
  warn,
  createTask,
  clear,
  count,
  countReset,
  dir,
  dirxml,
  group,
  groupEnd,
  groupCollapsed,
  profile,
  profileEnd,
  time,
  timeEnd,
  timeLog,
  timeStamp,
  Console,
  _times,
  _stdoutErrorHandler,
  _stderrErrorHandler;
var init_console = __esm({
  'node_modules/unenv/dist/runtime/node/console.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_noop();
    init_utils();
    _console = globalThis.console;
    _ignoreErrors = true;
    _stderr = new Writable();
    _stdout = new Writable();
    log = _console?.log ?? noop_default;
    info = _console?.info ?? log;
    trace = _console?.trace ?? info;
    debug = _console?.debug ?? log;
    table = _console?.table ?? log;
    error = _console?.error ?? log;
    warn = _console?.warn ?? error;
    createTask =
      _console?.createTask ??
      /* @__PURE__ */ notImplemented('console.createTask');
    clear = _console?.clear ?? noop_default;
    count = _console?.count ?? noop_default;
    countReset = _console?.countReset ?? noop_default;
    dir = _console?.dir ?? noop_default;
    dirxml = _console?.dirxml ?? noop_default;
    group = _console?.group ?? noop_default;
    groupEnd = _console?.groupEnd ?? noop_default;
    groupCollapsed = _console?.groupCollapsed ?? noop_default;
    profile = _console?.profile ?? noop_default;
    profileEnd = _console?.profileEnd ?? noop_default;
    time = _console?.time ?? noop_default;
    timeEnd = _console?.timeEnd ?? noop_default;
    timeLog = _console?.timeLog ?? noop_default;
    timeStamp = _console?.timeStamp ?? noop_default;
    Console =
      _console?.Console ??
      /* @__PURE__ */ notImplementedClass('console.Console');
    _times = /* @__PURE__ */ new Map();
    _stdoutErrorHandler = noop_default;
    _stderrErrorHandler = noop_default;
  },
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole,
  assert,
  clear2,
  context,
  count2,
  countReset2,
  createTask2,
  debug2,
  dir2,
  dirxml2,
  error2,
  group2,
  groupCollapsed2,
  groupEnd2,
  info2,
  log2,
  profile2,
  profileEnd2,
  table2,
  time2,
  timeEnd2,
  timeLog2,
  timeStamp2,
  trace2,
  warn2,
  console_default;
var init_console2 = __esm({
  'node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_console();
    workerdConsole = globalThis['console'];
    ({
      assert,
      clear: clear2,
      context:
        // @ts-expect-error undocumented public API
        context,
      count: count2,
      countReset: countReset2,
      createTask:
        // @ts-expect-error undocumented public API
        createTask2,
      debug: debug2,
      dir: dir2,
      dirxml: dirxml2,
      error: error2,
      group: group2,
      groupCollapsed: groupCollapsed2,
      groupEnd: groupEnd2,
      info: info2,
      log: log2,
      profile: profile2,
      profileEnd: profileEnd2,
      table: table2,
      time: time2,
      timeEnd: timeEnd2,
      timeLog: timeLog2,
      timeStamp: timeStamp2,
      trace: trace2,
      warn: warn2,
    } = workerdConsole);
    Object.assign(workerdConsole, {
      Console,
      _ignoreErrors,
      _stderr,
      _stderrErrorHandler,
      _stdout,
      _stdoutErrorHandler,
      _times,
    });
    console_default = workerdConsole;
  },
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console =
  __esm({
    'node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console'() {
      init_console2();
      globalThis.console = console_default;
    },
  });

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  'node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(
      /* @__PURE__ */ __name(function hrtime2(startTime) {
        const now = Date.now();
        const seconds = Math.trunc(now / 1e3);
        const nanos = (now % 1e3) * 1e6;
        if (startTime) {
          let diffSeconds = seconds - startTime[0];
          let diffNanos = nanos - startTime[0];
          if (diffNanos < 0) {
            diffSeconds = diffSeconds - 1;
            diffNanos = 1e9 + diffNanos;
          }
          return [diffSeconds, diffNanos];
        }
        return [seconds, nanos];
      }, 'hrtime'),
      {
        bigint: /* @__PURE__ */ __name(function bigint() {
          return BigInt(Date.now() * 1e6);
        }, 'bigint'),
      }
    );
  },
});

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream;
var init_read_stream = __esm({
  'node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    ReadStream = class {
      static {
        __name(this, 'ReadStream');
      }
      fd;
      isRaw = false;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
    };
  },
});

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream;
var init_write_stream = __esm({
  'node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    WriteStream = class {
      static {
        __name(this, 'WriteStream');
      }
      fd;
      columns = 80;
      rows = 24;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      clearLine(dir3, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === 'function' && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count3, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      write(str, encoding, cb) {
        if (str instanceof Uint8Array) {
          str = new TextDecoder().decode(str);
        }
        try {
          console.log(str);
        } catch {}
        cb && typeof cb === 'function' && cb();
        return false;
      }
    };
  },
});

// node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  'node_modules/unenv/dist/runtime/node/tty.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_read_stream();
    init_write_stream();
  },
});

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION;
var init_node_version = __esm({
  'node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    NODE_VERSION = '22.14.0';
  },
});

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from 'node:events';
var Process;
var init_process = __esm({
  'node_modules/unenv/dist/runtime/node/internal/process/process.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_tty();
    init_utils();
    init_node_version();
    Process = class _Process extends EventEmitter {
      static {
        __name(this, 'Process');
      }
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [
          ...Object.getOwnPropertyNames(_Process.prototype),
          ...Object.getOwnPropertyNames(EventEmitter.prototype),
        ]) {
          const value = this[prop];
          if (typeof value === 'function') {
            this[prop] = value.bind(this);
          }
        }
      }
      // --- event emitter ---
      emitWarning(warning, type, code) {
        console.warn(
          `${code ? `[${code}] ` : ''}${type ? `${type}: ` : ''}${warning}`
        );
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      // --- stdio (lazy initializers) ---
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return (this.#stdin ??= new ReadStream(0));
      }
      get stdout() {
        return (this.#stdout ??= new WriteStream(1));
      }
      get stderr() {
        return (this.#stderr ??= new WriteStream(2));
      }
      // --- cwd ---
      #cwd = '/';
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      // --- dummy props and getters ---
      arch = '';
      platform = '';
      argv = [];
      argv0 = '';
      execArgv = [];
      execPath = '';
      title = '';
      pid = 200;
      ppid = 100;
      get version() {
        return `v${NODE_VERSION}`;
      }
      get versions() {
        return { node: NODE_VERSION };
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      // --- noop methods ---
      ref() {}
      unref() {}
      // --- unimplemented methods ---
      umask() {
        throw createNotImplementedError('process.umask');
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError('process.getActiveResourcesInfo');
      }
      exit() {
        throw createNotImplementedError('process.exit');
      }
      reallyExit() {
        throw createNotImplementedError('process.reallyExit');
      }
      kill() {
        throw createNotImplementedError('process.kill');
      }
      abort() {
        throw createNotImplementedError('process.abort');
      }
      dlopen() {
        throw createNotImplementedError('process.dlopen');
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError('process.setSourceMapsEnabled');
      }
      loadEnvFile() {
        throw createNotImplementedError('process.loadEnvFile');
      }
      disconnect() {
        throw createNotImplementedError('process.disconnect');
      }
      cpuUsage() {
        throw createNotImplementedError('process.cpuUsage');
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError(
          'process.setUncaughtExceptionCaptureCallback'
        );
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError(
          'process.hasUncaughtExceptionCaptureCallback'
        );
      }
      initgroups() {
        throw createNotImplementedError('process.initgroups');
      }
      openStdin() {
        throw createNotImplementedError('process.openStdin');
      }
      assert() {
        throw createNotImplementedError('process.assert');
      }
      binding() {
        throw createNotImplementedError('process.binding');
      }
      // --- attached interfaces ---
      permission = {
        has: /* @__PURE__ */ notImplemented('process.permission.has'),
      };
      report = {
        directory: '',
        filename: '',
        signal: 'SIGUSR2',
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented('process.report.getReport'),
        writeReport: /* @__PURE__ */ notImplemented(
          'process.report.writeReport'
        ),
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented(
          'process.finalization.register'
        ),
        unregister: /* @__PURE__ */ notImplemented(
          'process.finalization.unregister'
        ),
        registerBeforeExit: /* @__PURE__ */ notImplemented(
          'process.finalization.registerBeforeExit'
        ),
      };
      memoryUsage = Object.assign(
        () => ({
          arrayBuffers: 0,
          rss: 0,
          external: 0,
          heapTotal: 0,
          heapUsed: 0,
        }),
        { rss: /* @__PURE__ */ __name(() => 0, 'rss') }
      );
      // --- undefined props ---
      mainModule = void 0;
      domain = void 0;
      // optional
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      // internals
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
  },
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess,
  getBuiltinModule,
  workerdProcess,
  isWorkerdProcessV2,
  unenvProcess,
  exit,
  features,
  platform,
  env,
  hrtime3,
  nextTick,
  _channel,
  _disconnect,
  _events,
  _eventsCount,
  _handleQueue,
  _maxListeners,
  _pendingMessage,
  _send,
  assert2,
  disconnect,
  mainModule,
  _debugEnd,
  _debugProcess,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _linkedBinding,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  domain,
  emit,
  emitWarning,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  memoryUsage,
  moduleLoadList,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions,
  _process,
  process_default;
var init_process2 = __esm({
  'node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis['process'];
    getBuiltinModule = globalProcess.getBuiltinModule;
    workerdProcess = getBuiltinModule('node:process');
    isWorkerdProcessV2 =
      globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
    unenvProcess = new Process({
      env: globalProcess.env,
      // `hrtime` is only available from workerd process v2
      hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
      // `nextTick` is available from workerd process v1
      nextTick: workerdProcess.nextTick,
    });
    ({ exit, features, platform } = workerdProcess);
    ({
      env:
        // Always implemented by workerd
        env,
      hrtime:
        // Only implemented in workerd v2
        hrtime3,
      nextTick:
        // Always implemented by workerd
        nextTick,
    } = unenvProcess);
    ({
      _channel,
      _disconnect,
      _events,
      _eventsCount,
      _handleQueue,
      _maxListeners,
      _pendingMessage,
      _send,
      assert: assert2,
      disconnect,
      mainModule,
    } = unenvProcess);
    ({
      _debugEnd:
        // @ts-expect-error `_debugEnd` is missing typings
        _debugEnd,
      _debugProcess:
        // @ts-expect-error `_debugProcess` is missing typings
        _debugProcess,
      _exiting:
        // @ts-expect-error `_exiting` is missing typings
        _exiting,
      _fatalException:
        // @ts-expect-error `_fatalException` is missing typings
        _fatalException,
      _getActiveHandles:
        // @ts-expect-error `_getActiveHandles` is missing typings
        _getActiveHandles,
      _getActiveRequests:
        // @ts-expect-error `_getActiveRequests` is missing typings
        _getActiveRequests,
      _kill:
        // @ts-expect-error `_kill` is missing typings
        _kill,
      _linkedBinding:
        // @ts-expect-error `_linkedBinding` is missing typings
        _linkedBinding,
      _preload_modules:
        // @ts-expect-error `_preload_modules` is missing typings
        _preload_modules,
      _rawDebug:
        // @ts-expect-error `_rawDebug` is missing typings
        _rawDebug,
      _startProfilerIdleNotifier:
        // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
        _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier:
        // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
        _stopProfilerIdleNotifier,
      _tickCallback:
        // @ts-expect-error `_tickCallback` is missing typings
        _tickCallback,
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      arch,
      argv,
      argv0,
      availableMemory,
      binding:
        // @ts-expect-error `binding` is missing typings
        binding,
      channel,
      chdir,
      config,
      connected,
      constrainedMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      domain:
        // @ts-expect-error `domain` is missing typings
        domain,
      emit,
      emitWarning,
      eventNames,
      execArgv,
      execPath,
      exitCode,
      finalization,
      getActiveResourcesInfo,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getMaxListeners,
      getuid,
      hasUncaughtExceptionCaptureCallback,
      initgroups:
        // @ts-expect-error `initgroups` is missing typings
        initgroups,
      kill,
      listenerCount,
      listeners,
      loadEnvFile,
      memoryUsage,
      moduleLoadList:
        // @ts-expect-error `moduleLoadList` is missing typings
        moduleLoadList,
      off,
      on,
      once,
      openStdin:
        // @ts-expect-error `openStdin` is missing typings
        openStdin,
      permission,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      reallyExit:
        // @ts-expect-error `reallyExit` is missing typings
        reallyExit,
      ref,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      send,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setMaxListeners,
      setSourceMapsEnabled,
      setuid,
      setUncaughtExceptionCaptureCallback,
      sourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      throwDeprecation,
      title,
      traceDeprecation,
      umask,
      unref,
      uptime,
      version,
      versions,
    } = isWorkerdProcessV2 ? workerdProcess : unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding,
    };
    process_default = _process;
  },
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process =
  __esm({
    'node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process'() {
      init_process2();
      globalThis.process = process_default;
    },
  });

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  'wrangler-modules-watch:wrangler:modules-watch'() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  },
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  'node_modules/wrangler/templates/modules-watch-stub.js'() {
    init_wrangler_modules_watch();
  },
});

// node_modules/punycode/punycode.js
var require_punycode = __commonJS({
  'node_modules/punycode/punycode.js'(exports, module) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var maxInt = 2147483647;
    var base = 36;
    var tMin = 1;
    var tMax = 26;
    var skew = 38;
    var damp = 700;
    var initialBias = 72;
    var initialN = 128;
    var delimiter = '-';
    var regexPunycode = /^xn--/;
    var regexNonASCII = /[^\0-\x7F]/;
    var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
    var errors2 = {
      overflow: 'Overflow: input needs wider integers to process',
      'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
      'invalid-input': 'Invalid input',
    };
    var baseMinusTMin = base - tMin;
    var floor = Math.floor;
    var stringFromCharCode = String.fromCharCode;
    function error3(type) {
      throw new RangeError(errors2[type]);
    }
    __name(error3, 'error');
    function map3(array, callback) {
      const result = [];
      let length = array.length;
      while (length--) {
        result[length] = callback(array[length]);
      }
      return result;
    }
    __name(map3, 'map');
    function mapDomain(domain2, callback) {
      const parts = domain2.split('@');
      let result = '';
      if (parts.length > 1) {
        result = parts[0] + '@';
        domain2 = parts[1];
      }
      domain2 = domain2.replace(regexSeparators, '.');
      const labels = domain2.split('.');
      const encoded = map3(labels, callback).join('.');
      return result + encoded;
    }
    __name(mapDomain, 'mapDomain');
    function ucs2decode(string) {
      const output = [];
      let counter = 0;
      const length = string.length;
      while (counter < length) {
        const value = string.charCodeAt(counter++);
        if (value >= 55296 && value <= 56319 && counter < length) {
          const extra = string.charCodeAt(counter++);
          if ((extra & 64512) == 56320) {
            output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
          } else {
            output.push(value);
            counter--;
          }
        } else {
          output.push(value);
        }
      }
      return output;
    }
    __name(ucs2decode, 'ucs2decode');
    var ucs2encode = /* @__PURE__ */ __name(
      (codePoints) => String.fromCodePoint(...codePoints),
      'ucs2encode'
    );
    var basicToDigit = /* @__PURE__ */ __name(function (codePoint) {
      if (codePoint >= 48 && codePoint < 58) {
        return 26 + (codePoint - 48);
      }
      if (codePoint >= 65 && codePoint < 91) {
        return codePoint - 65;
      }
      if (codePoint >= 97 && codePoint < 123) {
        return codePoint - 97;
      }
      return base;
    }, 'basicToDigit');
    var digitToBasic = /* @__PURE__ */ __name(function (digit, flag) {
      return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
    }, 'digitToBasic');
    var adapt = /* @__PURE__ */ __name(function (delta, numPoints, firstTime) {
      let k = 0;
      delta = firstTime ? floor(delta / damp) : delta >> 1;
      delta += floor(delta / numPoints);
      for (; delta > (baseMinusTMin * tMax) >> 1; k += base) {
        delta = floor(delta / baseMinusTMin);
      }
      return floor(k + ((baseMinusTMin + 1) * delta) / (delta + skew));
    }, 'adapt');
    var decode = /* @__PURE__ */ __name(function (input) {
      const output = [];
      const inputLength = input.length;
      let i = 0;
      let n = initialN;
      let bias = initialBias;
      let basic = input.lastIndexOf(delimiter);
      if (basic < 0) {
        basic = 0;
      }
      for (let j = 0; j < basic; ++j) {
        if (input.charCodeAt(j) >= 128) {
          error3('not-basic');
        }
        output.push(input.charCodeAt(j));
      }
      for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
        const oldi = i;
        for (let w = 1, k = base; ; k += base) {
          if (index >= inputLength) {
            error3('invalid-input');
          }
          const digit = basicToDigit(input.charCodeAt(index++));
          if (digit >= base) {
            error3('invalid-input');
          }
          if (digit > floor((maxInt - i) / w)) {
            error3('overflow');
          }
          i += digit * w;
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (digit < t) {
            break;
          }
          const baseMinusT = base - t;
          if (w > floor(maxInt / baseMinusT)) {
            error3('overflow');
          }
          w *= baseMinusT;
        }
        const out = output.length + 1;
        bias = adapt(i - oldi, out, oldi == 0);
        if (floor(i / out) > maxInt - n) {
          error3('overflow');
        }
        n += floor(i / out);
        i %= out;
        output.splice(i++, 0, n);
      }
      return String.fromCodePoint(...output);
    }, 'decode');
    var encode = /* @__PURE__ */ __name(function (input) {
      const output = [];
      input = ucs2decode(input);
      const inputLength = input.length;
      let n = initialN;
      let delta = 0;
      let bias = initialBias;
      for (const currentValue of input) {
        if (currentValue < 128) {
          output.push(stringFromCharCode(currentValue));
        }
      }
      const basicLength = output.length;
      let handledCPCount = basicLength;
      if (basicLength) {
        output.push(delimiter);
      }
      while (handledCPCount < inputLength) {
        let m = maxInt;
        for (const currentValue of input) {
          if (currentValue >= n && currentValue < m) {
            m = currentValue;
          }
        }
        const handledCPCountPlusOne = handledCPCount + 1;
        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
          error3('overflow');
        }
        delta += (m - n) * handledCPCountPlusOne;
        n = m;
        for (const currentValue of input) {
          if (currentValue < n && ++delta > maxInt) {
            error3('overflow');
          }
          if (currentValue === n) {
            let q = delta;
            for (let k = base; ; k += base) {
              const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (q < t) {
                break;
              }
              const qMinusT = q - t;
              const baseMinusT = base - t;
              output.push(
                stringFromCharCode(digitToBasic(t + (qMinusT % baseMinusT), 0))
              );
              q = floor(qMinusT / baseMinusT);
            }
            output.push(stringFromCharCode(digitToBasic(q, 0)));
            bias = adapt(
              delta,
              handledCPCountPlusOne,
              handledCPCount === basicLength
            );
            delta = 0;
            ++handledCPCount;
          }
        }
        ++delta;
        ++n;
      }
      return output.join('');
    }, 'encode');
    var toUnicode = /* @__PURE__ */ __name(function (input) {
      return mapDomain(input, function (string) {
        return regexPunycode.test(string)
          ? decode(string.slice(4).toLowerCase())
          : string;
      });
    }, 'toUnicode');
    var toASCII = /* @__PURE__ */ __name(function (input) {
      return mapDomain(input, function (string) {
        return regexNonASCII.test(string) ? 'xn--' + encode(string) : string;
      });
    }, 'toASCII');
    var punycode = {
      /**
       * A string representing the current Punycode.js version number.
       * @memberOf punycode
       * @type String
       */
      version: '2.3.1',
      /**
       * An object of methods to convert from JavaScript's internal character
       * representation (UCS-2) to Unicode code points, and back.
       * @see <https://mathiasbynens.be/notes/javascript-encoding>
       * @memberOf punycode
       * @type Object
       */
      ucs2: {
        decode: ucs2decode,
        encode: ucs2encode,
      },
      decode: decode,
      encode: encode,
      toASCII: toASCII,
      toUnicode: toUnicode,
    };
    module.exports = punycode;
  },
});

// node_modules/requires-port/index.js
var require_requires_port = __commonJS({
  'node_modules/requires-port/index.js'(exports, module) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = /* @__PURE__ */ __name(function required(port, protocol) {
      protocol = protocol.split(':')[0];
      port = +port;
      if (!port) return false;
      switch (protocol) {
        case 'http':
        case 'ws':
          return port !== 80;
        case 'https':
        case 'wss':
          return port !== 443;
        case 'ftp':
          return port !== 21;
        case 'gopher':
          return port !== 70;
        case 'file':
          return false;
      }
      return port !== 0;
    }, 'required');
  },
});

// node_modules/querystringify/index.js
var require_querystringify = __commonJS({
  'node_modules/querystringify/index.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var has = Object.prototype.hasOwnProperty;
    var undef;
    function decode(input) {
      try {
        return decodeURIComponent(input.replace(/\+/g, ' '));
      } catch (e) {
        return null;
      }
    }
    __name(decode, 'decode');
    function encode(input) {
      try {
        return encodeURIComponent(input);
      } catch (e) {
        return null;
      }
    }
    __name(encode, 'encode');
    function querystring(query) {
      var parser = /([^=?#&]+)=?([^&]*)/g,
        result = {},
        part;
      while ((part = parser.exec(query))) {
        var key = decode(part[1]),
          value = decode(part[2]);
        if (key === null || value === null || key in result) continue;
        result[key] = value;
      }
      return result;
    }
    __name(querystring, 'querystring');
    function querystringify(obj, prefix) {
      prefix = prefix || '';
      var pairs = [],
        value,
        key;
      if ('string' !== typeof prefix) prefix = '?';
      for (key in obj) {
        if (has.call(obj, key)) {
          value = obj[key];
          if (!value && (value === null || value === undef || isNaN(value))) {
            value = '';
          }
          key = encode(key);
          value = encode(value);
          if (key === null || value === null) continue;
          pairs.push(key + '=' + value);
        }
      }
      return pairs.length ? prefix + pairs.join('&') : '';
    }
    __name(querystringify, 'querystringify');
    exports.stringify = querystringify;
    exports.parse = querystring;
  },
});

// node_modules/url-parse/index.js
var require_url_parse = __commonJS({
  'node_modules/url-parse/index.js'(exports, module) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var required = require_requires_port();
    var qs = require_querystringify();
    var controlOrWhitespace =
      /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
    var CRHTLF = /[\n\r\t]/g;
    var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;
    var port = /:\d+$/;
    var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i;
    var windowsDriveLetter = /^[a-zA-Z]:/;
    function trimLeft(str) {
      return (str ? str : '').toString().replace(controlOrWhitespace, '');
    }
    __name(trimLeft, 'trimLeft');
    var rules = [
      ['#', 'hash'],
      // Extract from the back.
      ['?', 'query'],
      // Extract from the back.
      /* @__PURE__ */ __name(function sanitize(address, url) {
        return isSpecial(url.protocol) ? address.replace(/\\/g, '/') : address;
      }, 'sanitize'),
      ['/', 'pathname'],
      // Extract from the back.
      ['@', 'auth', 1],
      // Extract from the front.
      [NaN, 'host', void 0, 1, 1],
      // Set left over value.
      [/:(\d*)$/, 'port', void 0, 1],
      // RegExp the back.
      [NaN, 'hostname', void 0, 1, 1],
      // Set left over.
    ];
    var ignore = { hash: 1, query: 1 };
    function lolcation(loc) {
      var globalVar;
      if (typeof window !== 'undefined') globalVar = window;
      else if (typeof global !== 'undefined') globalVar = global;
      else if (typeof self !== 'undefined') globalVar = self;
      else globalVar = {};
      var location = globalVar.location || {};
      loc = loc || location;
      var finaldestination = {},
        type = typeof loc,
        key;
      if ('blob:' === loc.protocol) {
        finaldestination = new Url(unescape(loc.pathname), {});
      } else if ('string' === type) {
        finaldestination = new Url(loc, {});
        for (key in ignore) delete finaldestination[key];
      } else if ('object' === type) {
        for (key in loc) {
          if (key in ignore) continue;
          finaldestination[key] = loc[key];
        }
        if (finaldestination.slashes === void 0) {
          finaldestination.slashes = slashes.test(loc.href);
        }
      }
      return finaldestination;
    }
    __name(lolcation, 'lolcation');
    function isSpecial(scheme) {
      return (
        scheme === 'file:' ||
        scheme === 'ftp:' ||
        scheme === 'http:' ||
        scheme === 'https:' ||
        scheme === 'ws:' ||
        scheme === 'wss:'
      );
    }
    __name(isSpecial, 'isSpecial');
    function extractProtocol(address, location) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, '');
      location = location || {};
      var match = protocolre.exec(address);
      var protocol = match[1] ? match[1].toLowerCase() : '';
      var forwardSlashes = !!match[2];
      var otherSlashes = !!match[3];
      var slashesCount = 0;
      var rest;
      if (forwardSlashes) {
        if (otherSlashes) {
          rest = match[2] + match[3] + match[4];
          slashesCount = match[2].length + match[3].length;
        } else {
          rest = match[2] + match[4];
          slashesCount = match[2].length;
        }
      } else {
        if (otherSlashes) {
          rest = match[3] + match[4];
          slashesCount = match[3].length;
        } else {
          rest = match[4];
        }
      }
      if (protocol === 'file:') {
        if (slashesCount >= 2) {
          rest = rest.slice(2);
        }
      } else if (isSpecial(protocol)) {
        rest = match[4];
      } else if (protocol) {
        if (forwardSlashes) {
          rest = rest.slice(2);
        }
      } else if (slashesCount >= 2 && isSpecial(location.protocol)) {
        rest = match[4];
      }
      return {
        protocol,
        slashes: forwardSlashes || isSpecial(protocol),
        slashesCount,
        rest,
      };
    }
    __name(extractProtocol, 'extractProtocol');
    function resolve(relative, base) {
      if (relative === '') return base;
      var path = (base || '/')
          .split('/')
          .slice(0, -1)
          .concat(relative.split('/')),
        i = path.length,
        last = path[i - 1],
        unshift = false,
        up = 0;
      while (i--) {
        if (path[i] === '.') {
          path.splice(i, 1);
        } else if (path[i] === '..') {
          path.splice(i, 1);
          up++;
        } else if (up) {
          if (i === 0) unshift = true;
          path.splice(i, 1);
          up--;
        }
      }
      if (unshift) path.unshift('');
      if (last === '.' || last === '..') path.push('');
      return path.join('/');
    }
    __name(resolve, 'resolve');
    function Url(address, location, parser) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, '');
      if (!(this instanceof Url)) {
        return new Url(address, location, parser);
      }
      var relative,
        extracted,
        parse,
        instruction,
        index,
        key,
        instructions = rules.slice(),
        type = typeof location,
        url = this,
        i = 0;
      if ('object' !== type && 'string' !== type) {
        parser = location;
        location = null;
      }
      if (parser && 'function' !== typeof parser) parser = qs.parse;
      location = lolcation(location);
      extracted = extractProtocol(address || '', location);
      relative = !extracted.protocol && !extracted.slashes;
      url.slashes = extracted.slashes || (relative && location.slashes);
      url.protocol = extracted.protocol || location.protocol || '';
      address = extracted.rest;
      if (
        (extracted.protocol === 'file:' &&
          (extracted.slashesCount !== 2 || windowsDriveLetter.test(address))) ||
        (!extracted.slashes &&
          (extracted.protocol ||
            extracted.slashesCount < 2 ||
            !isSpecial(url.protocol)))
      ) {
        instructions[3] = [/(.*)/, 'pathname'];
      }
      for (; i < instructions.length; i++) {
        instruction = instructions[i];
        if (typeof instruction === 'function') {
          address = instruction(address, url);
          continue;
        }
        parse = instruction[0];
        key = instruction[1];
        if (parse !== parse) {
          url[key] = address;
        } else if ('string' === typeof parse) {
          index =
            parse === '@' ? address.lastIndexOf(parse) : address.indexOf(parse);
          if (~index) {
            if ('number' === typeof instruction[2]) {
              url[key] = address.slice(0, index);
              address = address.slice(index + instruction[2]);
            } else {
              url[key] = address.slice(index);
              address = address.slice(0, index);
            }
          }
        } else if ((index = parse.exec(address))) {
          url[key] = index[1];
          address = address.slice(0, index.index);
        }
        url[key] =
          url[key] || (relative && instruction[3] ? location[key] || '' : '');
        if (instruction[4]) url[key] = url[key].toLowerCase();
      }
      if (parser) url.query = parser(url.query);
      if (
        relative &&
        location.slashes &&
        url.pathname.charAt(0) !== '/' &&
        (url.pathname !== '' || location.pathname !== '')
      ) {
        url.pathname = resolve(url.pathname, location.pathname);
      }
      if (url.pathname.charAt(0) !== '/' && isSpecial(url.protocol)) {
        url.pathname = '/' + url.pathname;
      }
      if (!required(url.port, url.protocol)) {
        url.host = url.hostname;
        url.port = '';
      }
      url.username = url.password = '';
      if (url.auth) {
        index = url.auth.indexOf(':');
        if (~index) {
          url.username = url.auth.slice(0, index);
          url.username = encodeURIComponent(decodeURIComponent(url.username));
          url.password = url.auth.slice(index + 1);
          url.password = encodeURIComponent(decodeURIComponent(url.password));
        } else {
          url.username = encodeURIComponent(decodeURIComponent(url.auth));
        }
        url.auth = url.password
          ? url.username + ':' + url.password
          : url.username;
      }
      url.origin =
        url.protocol !== 'file:' && isSpecial(url.protocol) && url.host
          ? url.protocol + '//' + url.host
          : 'null';
      url.href = url.toString();
    }
    __name(Url, 'Url');
    function set(part, value, fn) {
      var url = this;
      switch (part) {
        case 'query':
          if ('string' === typeof value && value.length) {
            value = (fn || qs.parse)(value);
          }
          url[part] = value;
          break;
        case 'port':
          url[part] = value;
          if (!required(value, url.protocol)) {
            url.host = url.hostname;
            url[part] = '';
          } else if (value) {
            url.host = url.hostname + ':' + value;
          }
          break;
        case 'hostname':
          url[part] = value;
          if (url.port) value += ':' + url.port;
          url.host = value;
          break;
        case 'host':
          url[part] = value;
          if (port.test(value)) {
            value = value.split(':');
            url.port = value.pop();
            url.hostname = value.join(':');
          } else {
            url.hostname = value;
            url.port = '';
          }
          break;
        case 'protocol':
          url.protocol = value.toLowerCase();
          url.slashes = !fn;
          break;
        case 'pathname':
        case 'hash':
          if (value) {
            var char = part === 'pathname' ? '/' : '#';
            url[part] = value.charAt(0) !== char ? char + value : value;
          } else {
            url[part] = value;
          }
          break;
        case 'username':
        case 'password':
          url[part] = encodeURIComponent(value);
          break;
        case 'auth':
          var index = value.indexOf(':');
          if (~index) {
            url.username = value.slice(0, index);
            url.username = encodeURIComponent(decodeURIComponent(url.username));
            url.password = value.slice(index + 1);
            url.password = encodeURIComponent(decodeURIComponent(url.password));
          } else {
            url.username = encodeURIComponent(decodeURIComponent(value));
          }
      }
      for (var i = 0; i < rules.length; i++) {
        var ins = rules[i];
        if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
      }
      url.auth = url.password
        ? url.username + ':' + url.password
        : url.username;
      url.origin =
        url.protocol !== 'file:' && isSpecial(url.protocol) && url.host
          ? url.protocol + '//' + url.host
          : 'null';
      url.href = url.toString();
      return url;
    }
    __name(set, 'set');
    function toString(stringify) {
      if (!stringify || 'function' !== typeof stringify)
        stringify = qs.stringify;
      var query,
        url = this,
        host = url.host,
        protocol = url.protocol;
      if (protocol && protocol.charAt(protocol.length - 1) !== ':')
        protocol += ':';
      var result =
        protocol +
        ((url.protocol && url.slashes) || isSpecial(url.protocol) ? '//' : '');
      if (url.username) {
        result += url.username;
        if (url.password) result += ':' + url.password;
        result += '@';
      } else if (url.password) {
        result += ':' + url.password;
        result += '@';
      } else if (
        url.protocol !== 'file:' &&
        isSpecial(url.protocol) &&
        !host &&
        url.pathname !== '/'
      ) {
        result += '@';
      }
      if (
        host[host.length - 1] === ':' ||
        (port.test(url.hostname) && !url.port)
      ) {
        host += ':';
      }
      result += host + url.pathname;
      query = 'object' === typeof url.query ? stringify(url.query) : url.query;
      if (query) result += '?' !== query.charAt(0) ? '?' + query : query;
      if (url.hash) result += url.hash;
      return result;
    }
    __name(toString, 'toString');
    Url.prototype = { set, toString };
    Url.extractProtocol = extractProtocol;
    Url.location = lolcation;
    Url.trimLeft = trimLeft;
    Url.qs = qs;
    module.exports = Url;
  },
});

// node_modules/psl/dist/psl.cjs
var require_psl = __commonJS({
  'node_modules/psl/dist/psl.cjs'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    Object.defineProperties(exports, {
      __esModule: { value: true },
      [Symbol.toStringTag]: { value: 'Module' },
    });
    function K(e) {
      return e &&
        e.__esModule &&
        Object.prototype.hasOwnProperty.call(e, 'default')
        ? e.default
        : e;
    }
    __name(K, 'K');
    var O;
    var F;
    function Q() {
      if (F) return O;
      F = 1;
      const e = 2147483647,
        s = 36,
        c = 1,
        o = 26,
        t = 38,
        d = 700,
        z = 72,
        y = 128,
        g = '-',
        P = /^xn--/,
        V = /[^\0-\x7F]/,
        G = /[\x2E\u3002\uFF0E\uFF61]/g,
        W = {
          overflow: 'Overflow: input needs wider integers to process',
          'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
          'invalid-input': 'Invalid input',
        },
        C = s - c,
        h = Math.floor,
        I = String.fromCharCode;
      function v(a) {
        throw new RangeError(W[a]);
      }
      __name(v, 'v');
      function U(a, i) {
        const m = [];
        let n = a.length;
        for (; n--; ) m[n] = i(a[n]);
        return m;
      }
      __name(U, 'U');
      function S(a, i) {
        const m = a.split('@');
        let n = '';
        (m.length > 1 && ((n = m[0] + '@'), (a = m[1])),
          (a = a.replace(G, '.')));
        const r = a.split('.'),
          p = U(r, i).join('.');
        return n + p;
      }
      __name(S, 'S');
      function L(a) {
        const i = [];
        let m = 0;
        const n = a.length;
        for (; m < n; ) {
          const r = a.charCodeAt(m++);
          if (r >= 55296 && r <= 56319 && m < n) {
            const p = a.charCodeAt(m++);
            (p & 64512) == 56320
              ? i.push(((r & 1023) << 10) + (p & 1023) + 65536)
              : (i.push(r), m--);
          } else i.push(r);
        }
        return i;
      }
      __name(L, 'L');
      const $ = /* @__PURE__ */ __name((a) => String.fromCodePoint(...a), '$'),
        J = /* @__PURE__ */ __name(function (a) {
          return a >= 48 && a < 58
            ? 26 + (a - 48)
            : a >= 65 && a < 91
              ? a - 65
              : a >= 97 && a < 123
                ? a - 97
                : s;
        }, 'J'),
        D = /* @__PURE__ */ __name(function (a, i) {
          return a + 22 + 75 * (a < 26) - ((i != 0) << 5);
        }, 'D'),
        T = /* @__PURE__ */ __name(function (a, i, m) {
          let n = 0;
          for (
            a = m ? h(a / d) : a >> 1, a += h(a / i);
            a > (C * o) >> 1;
            n += s
          )
            a = h(a / C);
          return h(n + ((C + 1) * a) / (a + t));
        }, 'T'),
        E = /* @__PURE__ */ __name(function (a) {
          const i = [],
            m = a.length;
          let n = 0,
            r = y,
            p = z,
            j = a.lastIndexOf(g);
          j < 0 && (j = 0);
          for (let u = 0; u < j; ++u)
            (a.charCodeAt(u) >= 128 && v('not-basic'), i.push(a.charCodeAt(u)));
          for (let u = j > 0 ? j + 1 : 0; u < m; ) {
            const k = n;
            for (let l = 1, b = s; ; b += s) {
              u >= m && v('invalid-input');
              const w = J(a.charCodeAt(u++));
              (w >= s && v('invalid-input'),
                w > h((e - n) / l) && v('overflow'),
                (n += w * l));
              const x = b <= p ? c : b >= p + o ? o : b - p;
              if (w < x) break;
              const q = s - x;
              (l > h(e / q) && v('overflow'), (l *= q));
            }
            const f = i.length + 1;
            ((p = T(n - k, f, k == 0)),
              h(n / f) > e - r && v('overflow'),
              (r += h(n / f)),
              (n %= f),
              i.splice(n++, 0, r));
          }
          return String.fromCodePoint(...i);
        }, 'E'),
        B = /* @__PURE__ */ __name(function (a) {
          const i = [];
          a = L(a);
          const m = a.length;
          let n = y,
            r = 0,
            p = z;
          for (const k of a) k < 128 && i.push(I(k));
          const j = i.length;
          let u = j;
          for (j && i.push(g); u < m; ) {
            let k = e;
            for (const l of a) l >= n && l < k && (k = l);
            const f = u + 1;
            (k - n > h((e - r) / f) && v('overflow'),
              (r += (k - n) * f),
              (n = k));
            for (const l of a)
              if ((l < n && ++r > e && v('overflow'), l === n)) {
                let b = r;
                for (let w = s; ; w += s) {
                  const x = w <= p ? c : w >= p + o ? o : w - p;
                  if (b < x) break;
                  const q = b - x,
                    M = s - x;
                  (i.push(I(D(x + (q % M), 0))), (b = h(q / M)));
                }
                (i.push(I(D(b, 0))), (p = T(r, f, u === j)), (r = 0), ++u);
              }
            (++r, ++n);
          }
          return i.join('');
        }, 'B');
      return (
        (O = {
          version: '2.3.1',
          ucs2: { decode: L, encode: $ },
          decode: E,
          encode: B,
          toASCII: /* @__PURE__ */ __name(function (a) {
            return S(a, function (i) {
              return V.test(i) ? 'xn--' + B(i) : i;
            });
          }, 'toASCII'),
          toUnicode: /* @__PURE__ */ __name(function (a) {
            return S(a, function (i) {
              return P.test(i) ? E(i.slice(4).toLowerCase()) : i;
            });
          }, 'toUnicode'),
        }),
        O
      );
    }
    __name(Q, 'Q');
    var X = Q();
    var A = K(X);
    var Y = [
      'ac',
      'com.ac',
      'edu.ac',
      'gov.ac',
      'mil.ac',
      'net.ac',
      'org.ac',
      'ad',
      'ae',
      'ac.ae',
      'co.ae',
      'gov.ae',
      'mil.ae',
      'net.ae',
      'org.ae',
      'sch.ae',
      'aero',
      'airline.aero',
      'airport.aero',
      'accident-investigation.aero',
      'accident-prevention.aero',
      'aerobatic.aero',
      'aeroclub.aero',
      'aerodrome.aero',
      'agents.aero',
      'air-surveillance.aero',
      'air-traffic-control.aero',
      'aircraft.aero',
      'airtraffic.aero',
      'ambulance.aero',
      'association.aero',
      'author.aero',
      'ballooning.aero',
      'broker.aero',
      'caa.aero',
      'cargo.aero',
      'catering.aero',
      'certification.aero',
      'championship.aero',
      'charter.aero',
      'civilaviation.aero',
      'club.aero',
      'conference.aero',
      'consultant.aero',
      'consulting.aero',
      'control.aero',
      'council.aero',
      'crew.aero',
      'design.aero',
      'dgca.aero',
      'educator.aero',
      'emergency.aero',
      'engine.aero',
      'engineer.aero',
      'entertainment.aero',
      'equipment.aero',
      'exchange.aero',
      'express.aero',
      'federation.aero',
      'flight.aero',
      'freight.aero',
      'fuel.aero',
      'gliding.aero',
      'government.aero',
      'groundhandling.aero',
      'group.aero',
      'hanggliding.aero',
      'homebuilt.aero',
      'insurance.aero',
      'journal.aero',
      'journalist.aero',
      'leasing.aero',
      'logistics.aero',
      'magazine.aero',
      'maintenance.aero',
      'marketplace.aero',
      'media.aero',
      'microlight.aero',
      'modelling.aero',
      'navigation.aero',
      'parachuting.aero',
      'paragliding.aero',
      'passenger-association.aero',
      'pilot.aero',
      'press.aero',
      'production.aero',
      'recreation.aero',
      'repbody.aero',
      'res.aero',
      'research.aero',
      'rotorcraft.aero',
      'safety.aero',
      'scientist.aero',
      'services.aero',
      'show.aero',
      'skydiving.aero',
      'software.aero',
      'student.aero',
      'taxi.aero',
      'trader.aero',
      'trading.aero',
      'trainer.aero',
      'union.aero',
      'workinggroup.aero',
      'works.aero',
      'af',
      'com.af',
      'edu.af',
      'gov.af',
      'net.af',
      'org.af',
      'ag',
      'co.ag',
      'com.ag',
      'net.ag',
      'nom.ag',
      'org.ag',
      'ai',
      'com.ai',
      'net.ai',
      'off.ai',
      'org.ai',
      'al',
      'com.al',
      'edu.al',
      'gov.al',
      'mil.al',
      'net.al',
      'org.al',
      'am',
      'co.am',
      'com.am',
      'commune.am',
      'net.am',
      'org.am',
      'ao',
      'co.ao',
      'ed.ao',
      'edu.ao',
      'gov.ao',
      'gv.ao',
      'it.ao',
      'og.ao',
      'org.ao',
      'pb.ao',
      'aq',
      'ar',
      'bet.ar',
      'com.ar',
      'coop.ar',
      'edu.ar',
      'gob.ar',
      'gov.ar',
      'int.ar',
      'mil.ar',
      'musica.ar',
      'mutual.ar',
      'net.ar',
      'org.ar',
      'senasa.ar',
      'tur.ar',
      'arpa',
      'e164.arpa',
      'home.arpa',
      'in-addr.arpa',
      'ip6.arpa',
      'iris.arpa',
      'uri.arpa',
      'urn.arpa',
      'as',
      'gov.as',
      'asia',
      'at',
      'ac.at',
      'sth.ac.at',
      'co.at',
      'gv.at',
      'or.at',
      'au',
      'asn.au',
      'com.au',
      'edu.au',
      'gov.au',
      'id.au',
      'net.au',
      'org.au',
      'conf.au',
      'oz.au',
      'act.au',
      'nsw.au',
      'nt.au',
      'qld.au',
      'sa.au',
      'tas.au',
      'vic.au',
      'wa.au',
      'act.edu.au',
      'catholic.edu.au',
      'nsw.edu.au',
      'nt.edu.au',
      'qld.edu.au',
      'sa.edu.au',
      'tas.edu.au',
      'vic.edu.au',
      'wa.edu.au',
      'qld.gov.au',
      'sa.gov.au',
      'tas.gov.au',
      'vic.gov.au',
      'wa.gov.au',
      'schools.nsw.edu.au',
      'aw',
      'com.aw',
      'ax',
      'az',
      'biz.az',
      'com.az',
      'edu.az',
      'gov.az',
      'info.az',
      'int.az',
      'mil.az',
      'name.az',
      'net.az',
      'org.az',
      'pp.az',
      'pro.az',
      'ba',
      'com.ba',
      'edu.ba',
      'gov.ba',
      'mil.ba',
      'net.ba',
      'org.ba',
      'bb',
      'biz.bb',
      'co.bb',
      'com.bb',
      'edu.bb',
      'gov.bb',
      'info.bb',
      'net.bb',
      'org.bb',
      'store.bb',
      'tv.bb',
      '*.bd',
      'be',
      'ac.be',
      'bf',
      'gov.bf',
      'bg',
      '0.bg',
      '1.bg',
      '2.bg',
      '3.bg',
      '4.bg',
      '5.bg',
      '6.bg',
      '7.bg',
      '8.bg',
      '9.bg',
      'a.bg',
      'b.bg',
      'c.bg',
      'd.bg',
      'e.bg',
      'f.bg',
      'g.bg',
      'h.bg',
      'i.bg',
      'j.bg',
      'k.bg',
      'l.bg',
      'm.bg',
      'n.bg',
      'o.bg',
      'p.bg',
      'q.bg',
      'r.bg',
      's.bg',
      't.bg',
      'u.bg',
      'v.bg',
      'w.bg',
      'x.bg',
      'y.bg',
      'z.bg',
      'bh',
      'com.bh',
      'edu.bh',
      'gov.bh',
      'net.bh',
      'org.bh',
      'bi',
      'co.bi',
      'com.bi',
      'edu.bi',
      'or.bi',
      'org.bi',
      'biz',
      'bj',
      'africa.bj',
      'agro.bj',
      'architectes.bj',
      'assur.bj',
      'avocats.bj',
      'co.bj',
      'com.bj',
      'eco.bj',
      'econo.bj',
      'edu.bj',
      'info.bj',
      'loisirs.bj',
      'money.bj',
      'net.bj',
      'org.bj',
      'ote.bj',
      'restaurant.bj',
      'resto.bj',
      'tourism.bj',
      'univ.bj',
      'bm',
      'com.bm',
      'edu.bm',
      'gov.bm',
      'net.bm',
      'org.bm',
      'bn',
      'com.bn',
      'edu.bn',
      'gov.bn',
      'net.bn',
      'org.bn',
      'bo',
      'com.bo',
      'edu.bo',
      'gob.bo',
      'int.bo',
      'mil.bo',
      'net.bo',
      'org.bo',
      'tv.bo',
      'web.bo',
      'academia.bo',
      'agro.bo',
      'arte.bo',
      'blog.bo',
      'bolivia.bo',
      'ciencia.bo',
      'cooperativa.bo',
      'democracia.bo',
      'deporte.bo',
      'ecologia.bo',
      'economia.bo',
      'empresa.bo',
      'indigena.bo',
      'industria.bo',
      'info.bo',
      'medicina.bo',
      'movimiento.bo',
      'musica.bo',
      'natural.bo',
      'nombre.bo',
      'noticias.bo',
      'patria.bo',
      'plurinacional.bo',
      'politica.bo',
      'profesional.bo',
      'pueblo.bo',
      'revista.bo',
      'salud.bo',
      'tecnologia.bo',
      'tksat.bo',
      'transporte.bo',
      'wiki.bo',
      'br',
      '9guacu.br',
      'abc.br',
      'adm.br',
      'adv.br',
      'agr.br',
      'aju.br',
      'am.br',
      'anani.br',
      'aparecida.br',
      'app.br',
      'arq.br',
      'art.br',
      'ato.br',
      'b.br',
      'barueri.br',
      'belem.br',
      'bet.br',
      'bhz.br',
      'bib.br',
      'bio.br',
      'blog.br',
      'bmd.br',
      'boavista.br',
      'bsb.br',
      'campinagrande.br',
      'campinas.br',
      'caxias.br',
      'cim.br',
      'cng.br',
      'cnt.br',
      'com.br',
      'contagem.br',
      'coop.br',
      'coz.br',
      'cri.br',
      'cuiaba.br',
      'curitiba.br',
      'def.br',
      'des.br',
      'det.br',
      'dev.br',
      'ecn.br',
      'eco.br',
      'edu.br',
      'emp.br',
      'enf.br',
      'eng.br',
      'esp.br',
      'etc.br',
      'eti.br',
      'far.br',
      'feira.br',
      'flog.br',
      'floripa.br',
      'fm.br',
      'fnd.br',
      'fortal.br',
      'fot.br',
      'foz.br',
      'fst.br',
      'g12.br',
      'geo.br',
      'ggf.br',
      'goiania.br',
      'gov.br',
      'ac.gov.br',
      'al.gov.br',
      'am.gov.br',
      'ap.gov.br',
      'ba.gov.br',
      'ce.gov.br',
      'df.gov.br',
      'es.gov.br',
      'go.gov.br',
      'ma.gov.br',
      'mg.gov.br',
      'ms.gov.br',
      'mt.gov.br',
      'pa.gov.br',
      'pb.gov.br',
      'pe.gov.br',
      'pi.gov.br',
      'pr.gov.br',
      'rj.gov.br',
      'rn.gov.br',
      'ro.gov.br',
      'rr.gov.br',
      'rs.gov.br',
      'sc.gov.br',
      'se.gov.br',
      'sp.gov.br',
      'to.gov.br',
      'gru.br',
      'imb.br',
      'ind.br',
      'inf.br',
      'jab.br',
      'jampa.br',
      'jdf.br',
      'joinville.br',
      'jor.br',
      'jus.br',
      'leg.br',
      'leilao.br',
      'lel.br',
      'log.br',
      'londrina.br',
      'macapa.br',
      'maceio.br',
      'manaus.br',
      'maringa.br',
      'mat.br',
      'med.br',
      'mil.br',
      'morena.br',
      'mp.br',
      'mus.br',
      'natal.br',
      'net.br',
      'niteroi.br',
      '*.nom.br',
      'not.br',
      'ntr.br',
      'odo.br',
      'ong.br',
      'org.br',
      'osasco.br',
      'palmas.br',
      'poa.br',
      'ppg.br',
      'pro.br',
      'psc.br',
      'psi.br',
      'pvh.br',
      'qsl.br',
      'radio.br',
      'rec.br',
      'recife.br',
      'rep.br',
      'ribeirao.br',
      'rio.br',
      'riobranco.br',
      'riopreto.br',
      'salvador.br',
      'sampa.br',
      'santamaria.br',
      'santoandre.br',
      'saobernardo.br',
      'saogonca.br',
      'seg.br',
      'sjc.br',
      'slg.br',
      'slz.br',
      'sorocaba.br',
      'srv.br',
      'taxi.br',
      'tc.br',
      'tec.br',
      'teo.br',
      'the.br',
      'tmp.br',
      'trd.br',
      'tur.br',
      'tv.br',
      'udi.br',
      'vet.br',
      'vix.br',
      'vlog.br',
      'wiki.br',
      'zlg.br',
      'bs',
      'com.bs',
      'edu.bs',
      'gov.bs',
      'net.bs',
      'org.bs',
      'bt',
      'com.bt',
      'edu.bt',
      'gov.bt',
      'net.bt',
      'org.bt',
      'bv',
      'bw',
      'co.bw',
      'org.bw',
      'by',
      'gov.by',
      'mil.by',
      'com.by',
      'of.by',
      'bz',
      'co.bz',
      'com.bz',
      'edu.bz',
      'gov.bz',
      'net.bz',
      'org.bz',
      'ca',
      'ab.ca',
      'bc.ca',
      'mb.ca',
      'nb.ca',
      'nf.ca',
      'nl.ca',
      'ns.ca',
      'nt.ca',
      'nu.ca',
      'on.ca',
      'pe.ca',
      'qc.ca',
      'sk.ca',
      'yk.ca',
      'gc.ca',
      'cat',
      'cc',
      'cd',
      'gov.cd',
      'cf',
      'cg',
      'ch',
      'ci',
      'ac.ci',
      'a\xE9roport.ci',
      'asso.ci',
      'co.ci',
      'com.ci',
      'ed.ci',
      'edu.ci',
      'go.ci',
      'gouv.ci',
      'int.ci',
      'net.ci',
      'or.ci',
      'org.ci',
      '*.ck',
      '!www.ck',
      'cl',
      'co.cl',
      'gob.cl',
      'gov.cl',
      'mil.cl',
      'cm',
      'co.cm',
      'com.cm',
      'gov.cm',
      'net.cm',
      'cn',
      'ac.cn',
      'com.cn',
      'edu.cn',
      'gov.cn',
      'mil.cn',
      'net.cn',
      'org.cn',
      '\u516C\u53F8.cn',
      '\u7DB2\u7D61.cn',
      '\u7F51\u7EDC.cn',
      'ah.cn',
      'bj.cn',
      'cq.cn',
      'fj.cn',
      'gd.cn',
      'gs.cn',
      'gx.cn',
      'gz.cn',
      'ha.cn',
      'hb.cn',
      'he.cn',
      'hi.cn',
      'hk.cn',
      'hl.cn',
      'hn.cn',
      'jl.cn',
      'js.cn',
      'jx.cn',
      'ln.cn',
      'mo.cn',
      'nm.cn',
      'nx.cn',
      'qh.cn',
      'sc.cn',
      'sd.cn',
      'sh.cn',
      'sn.cn',
      'sx.cn',
      'tj.cn',
      'tw.cn',
      'xj.cn',
      'xz.cn',
      'yn.cn',
      'zj.cn',
      'co',
      'com.co',
      'edu.co',
      'gov.co',
      'mil.co',
      'net.co',
      'nom.co',
      'org.co',
      'com',
      'coop',
      'cr',
      'ac.cr',
      'co.cr',
      'ed.cr',
      'fi.cr',
      'go.cr',
      'or.cr',
      'sa.cr',
      'cu',
      'com.cu',
      'edu.cu',
      'gob.cu',
      'inf.cu',
      'nat.cu',
      'net.cu',
      'org.cu',
      'cv',
      'com.cv',
      'edu.cv',
      'id.cv',
      'int.cv',
      'net.cv',
      'nome.cv',
      'org.cv',
      'publ.cv',
      'cw',
      'com.cw',
      'edu.cw',
      'net.cw',
      'org.cw',
      'cx',
      'gov.cx',
      'cy',
      'ac.cy',
      'biz.cy',
      'com.cy',
      'ekloges.cy',
      'gov.cy',
      'ltd.cy',
      'mil.cy',
      'net.cy',
      'org.cy',
      'press.cy',
      'pro.cy',
      'tm.cy',
      'cz',
      'de',
      'dj',
      'dk',
      'dm',
      'co.dm',
      'com.dm',
      'edu.dm',
      'gov.dm',
      'net.dm',
      'org.dm',
      'do',
      'art.do',
      'com.do',
      'edu.do',
      'gob.do',
      'gov.do',
      'mil.do',
      'net.do',
      'org.do',
      'sld.do',
      'web.do',
      'dz',
      'art.dz',
      'asso.dz',
      'com.dz',
      'edu.dz',
      'gov.dz',
      'net.dz',
      'org.dz',
      'pol.dz',
      'soc.dz',
      'tm.dz',
      'ec',
      'com.ec',
      'edu.ec',
      'fin.ec',
      'gob.ec',
      'gov.ec',
      'info.ec',
      'k12.ec',
      'med.ec',
      'mil.ec',
      'net.ec',
      'org.ec',
      'pro.ec',
      'edu',
      'ee',
      'aip.ee',
      'com.ee',
      'edu.ee',
      'fie.ee',
      'gov.ee',
      'lib.ee',
      'med.ee',
      'org.ee',
      'pri.ee',
      'riik.ee',
      'eg',
      'ac.eg',
      'com.eg',
      'edu.eg',
      'eun.eg',
      'gov.eg',
      'info.eg',
      'me.eg',
      'mil.eg',
      'name.eg',
      'net.eg',
      'org.eg',
      'sci.eg',
      'sport.eg',
      'tv.eg',
      '*.er',
      'es',
      'com.es',
      'edu.es',
      'gob.es',
      'nom.es',
      'org.es',
      'et',
      'biz.et',
      'com.et',
      'edu.et',
      'gov.et',
      'info.et',
      'name.et',
      'net.et',
      'org.et',
      'eu',
      'fi',
      'aland.fi',
      'fj',
      'ac.fj',
      'biz.fj',
      'com.fj',
      'gov.fj',
      'info.fj',
      'mil.fj',
      'name.fj',
      'net.fj',
      'org.fj',
      'pro.fj',
      '*.fk',
      'fm',
      'com.fm',
      'edu.fm',
      'net.fm',
      'org.fm',
      'fo',
      'fr',
      'asso.fr',
      'com.fr',
      'gouv.fr',
      'nom.fr',
      'prd.fr',
      'tm.fr',
      'avoues.fr',
      'cci.fr',
      'greta.fr',
      'huissier-justice.fr',
      'ga',
      'gb',
      'gd',
      'edu.gd',
      'gov.gd',
      'ge',
      'com.ge',
      'edu.ge',
      'gov.ge',
      'net.ge',
      'org.ge',
      'pvt.ge',
      'school.ge',
      'gf',
      'gg',
      'co.gg',
      'net.gg',
      'org.gg',
      'gh',
      'com.gh',
      'edu.gh',
      'gov.gh',
      'mil.gh',
      'org.gh',
      'gi',
      'com.gi',
      'edu.gi',
      'gov.gi',
      'ltd.gi',
      'mod.gi',
      'org.gi',
      'gl',
      'co.gl',
      'com.gl',
      'edu.gl',
      'net.gl',
      'org.gl',
      'gm',
      'gn',
      'ac.gn',
      'com.gn',
      'edu.gn',
      'gov.gn',
      'net.gn',
      'org.gn',
      'gov',
      'gp',
      'asso.gp',
      'com.gp',
      'edu.gp',
      'mobi.gp',
      'net.gp',
      'org.gp',
      'gq',
      'gr',
      'com.gr',
      'edu.gr',
      'gov.gr',
      'net.gr',
      'org.gr',
      'gs',
      'gt',
      'com.gt',
      'edu.gt',
      'gob.gt',
      'ind.gt',
      'mil.gt',
      'net.gt',
      'org.gt',
      'gu',
      'com.gu',
      'edu.gu',
      'gov.gu',
      'guam.gu',
      'info.gu',
      'net.gu',
      'org.gu',
      'web.gu',
      'gw',
      'gy',
      'co.gy',
      'com.gy',
      'edu.gy',
      'gov.gy',
      'net.gy',
      'org.gy',
      'hk',
      'com.hk',
      'edu.hk',
      'gov.hk',
      'idv.hk',
      'net.hk',
      'org.hk',
      '\u4E2A\u4EBA.hk',
      '\u500B\u4EBA.hk',
      '\u516C\u53F8.hk',
      '\u653F\u5E9C.hk',
      '\u654E\u80B2.hk',
      '\u6559\u80B2.hk',
      '\u7B87\u4EBA.hk',
      '\u7D44\u7E54.hk',
      '\u7D44\u7EC7.hk',
      '\u7DB2\u7D61.hk',
      '\u7DB2\u7EDC.hk',
      '\u7EC4\u7E54.hk',
      '\u7EC4\u7EC7.hk',
      '\u7F51\u7D61.hk',
      '\u7F51\u7EDC.hk',
      'hm',
      'hn',
      'com.hn',
      'edu.hn',
      'gob.hn',
      'mil.hn',
      'net.hn',
      'org.hn',
      'hr',
      'com.hr',
      'from.hr',
      'iz.hr',
      'name.hr',
      'ht',
      'adult.ht',
      'art.ht',
      'asso.ht',
      'com.ht',
      'coop.ht',
      'edu.ht',
      'firm.ht',
      'gouv.ht',
      'info.ht',
      'med.ht',
      'net.ht',
      'org.ht',
      'perso.ht',
      'pol.ht',
      'pro.ht',
      'rel.ht',
      'shop.ht',
      'hu',
      '2000.hu',
      'agrar.hu',
      'bolt.hu',
      'casino.hu',
      'city.hu',
      'co.hu',
      'erotica.hu',
      'erotika.hu',
      'film.hu',
      'forum.hu',
      'games.hu',
      'hotel.hu',
      'info.hu',
      'ingatlan.hu',
      'jogasz.hu',
      'konyvelo.hu',
      'lakas.hu',
      'media.hu',
      'news.hu',
      'org.hu',
      'priv.hu',
      'reklam.hu',
      'sex.hu',
      'shop.hu',
      'sport.hu',
      'suli.hu',
      'szex.hu',
      'tm.hu',
      'tozsde.hu',
      'utazas.hu',
      'video.hu',
      'id',
      'ac.id',
      'biz.id',
      'co.id',
      'desa.id',
      'go.id',
      'mil.id',
      'my.id',
      'net.id',
      'or.id',
      'ponpes.id',
      'sch.id',
      'web.id',
      'ie',
      'gov.ie',
      'il',
      'ac.il',
      'co.il',
      'gov.il',
      'idf.il',
      'k12.il',
      'muni.il',
      'net.il',
      'org.il',
      '\u05D9\u05E9\u05E8\u05D0\u05DC',
      '\u05D0\u05E7\u05D3\u05DE\u05D9\u05D4.\u05D9\u05E9\u05E8\u05D0\u05DC',
      '\u05D9\u05E9\u05D5\u05D1.\u05D9\u05E9\u05E8\u05D0\u05DC',
      '\u05E6\u05D4\u05DC.\u05D9\u05E9\u05E8\u05D0\u05DC',
      '\u05DE\u05DE\u05E9\u05DC.\u05D9\u05E9\u05E8\u05D0\u05DC',
      'im',
      'ac.im',
      'co.im',
      'ltd.co.im',
      'plc.co.im',
      'com.im',
      'net.im',
      'org.im',
      'tt.im',
      'tv.im',
      'in',
      '5g.in',
      '6g.in',
      'ac.in',
      'ai.in',
      'am.in',
      'bihar.in',
      'biz.in',
      'business.in',
      'ca.in',
      'cn.in',
      'co.in',
      'com.in',
      'coop.in',
      'cs.in',
      'delhi.in',
      'dr.in',
      'edu.in',
      'er.in',
      'firm.in',
      'gen.in',
      'gov.in',
      'gujarat.in',
      'ind.in',
      'info.in',
      'int.in',
      'internet.in',
      'io.in',
      'me.in',
      'mil.in',
      'net.in',
      'nic.in',
      'org.in',
      'pg.in',
      'post.in',
      'pro.in',
      'res.in',
      'travel.in',
      'tv.in',
      'uk.in',
      'up.in',
      'us.in',
      'info',
      'int',
      'eu.int',
      'io',
      'co.io',
      'com.io',
      'edu.io',
      'gov.io',
      'mil.io',
      'net.io',
      'nom.io',
      'org.io',
      'iq',
      'com.iq',
      'edu.iq',
      'gov.iq',
      'mil.iq',
      'net.iq',
      'org.iq',
      'ir',
      'ac.ir',
      'co.ir',
      'gov.ir',
      'id.ir',
      'net.ir',
      'org.ir',
      'sch.ir',
      '\u0627\u06CC\u0631\u0627\u0646.ir',
      '\u0627\u064A\u0631\u0627\u0646.ir',
      'is',
      'it',
      'edu.it',
      'gov.it',
      'abr.it',
      'abruzzo.it',
      'aosta-valley.it',
      'aostavalley.it',
      'bas.it',
      'basilicata.it',
      'cal.it',
      'calabria.it',
      'cam.it',
      'campania.it',
      'emilia-romagna.it',
      'emiliaromagna.it',
      'emr.it',
      'friuli-v-giulia.it',
      'friuli-ve-giulia.it',
      'friuli-vegiulia.it',
      'friuli-venezia-giulia.it',
      'friuli-veneziagiulia.it',
      'friuli-vgiulia.it',
      'friuliv-giulia.it',
      'friulive-giulia.it',
      'friulivegiulia.it',
      'friulivenezia-giulia.it',
      'friuliveneziagiulia.it',
      'friulivgiulia.it',
      'fvg.it',
      'laz.it',
      'lazio.it',
      'lig.it',
      'liguria.it',
      'lom.it',
      'lombardia.it',
      'lombardy.it',
      'lucania.it',
      'mar.it',
      'marche.it',
      'mol.it',
      'molise.it',
      'piedmont.it',
      'piemonte.it',
      'pmn.it',
      'pug.it',
      'puglia.it',
      'sar.it',
      'sardegna.it',
      'sardinia.it',
      'sic.it',
      'sicilia.it',
      'sicily.it',
      'taa.it',
      'tos.it',
      'toscana.it',
      'trentin-sud-tirol.it',
      'trentin-s\xFCd-tirol.it',
      'trentin-sudtirol.it',
      'trentin-s\xFCdtirol.it',
      'trentin-sued-tirol.it',
      'trentin-suedtirol.it',
      'trentino.it',
      'trentino-a-adige.it',
      'trentino-aadige.it',
      'trentino-alto-adige.it',
      'trentino-altoadige.it',
      'trentino-s-tirol.it',
      'trentino-stirol.it',
      'trentino-sud-tirol.it',
      'trentino-s\xFCd-tirol.it',
      'trentino-sudtirol.it',
      'trentino-s\xFCdtirol.it',
      'trentino-sued-tirol.it',
      'trentino-suedtirol.it',
      'trentinoa-adige.it',
      'trentinoaadige.it',
      'trentinoalto-adige.it',
      'trentinoaltoadige.it',
      'trentinos-tirol.it',
      'trentinostirol.it',
      'trentinosud-tirol.it',
      'trentinos\xFCd-tirol.it',
      'trentinosudtirol.it',
      'trentinos\xFCdtirol.it',
      'trentinosued-tirol.it',
      'trentinosuedtirol.it',
      'trentinsud-tirol.it',
      'trentins\xFCd-tirol.it',
      'trentinsudtirol.it',
      'trentins\xFCdtirol.it',
      'trentinsued-tirol.it',
      'trentinsuedtirol.it',
      'tuscany.it',
      'umb.it',
      'umbria.it',
      'val-d-aosta.it',
      'val-daosta.it',
      'vald-aosta.it',
      'valdaosta.it',
      'valle-aosta.it',
      'valle-d-aosta.it',
      'valle-daosta.it',
      'valleaosta.it',
      'valled-aosta.it',
      'valledaosta.it',
      'vallee-aoste.it',
      'vall\xE9e-aoste.it',
      'vallee-d-aoste.it',
      'vall\xE9e-d-aoste.it',
      'valleeaoste.it',
      'vall\xE9eaoste.it',
      'valleedaoste.it',
      'vall\xE9edaoste.it',
      'vao.it',
      'vda.it',
      'ven.it',
      'veneto.it',
      'ag.it',
      'agrigento.it',
      'al.it',
      'alessandria.it',
      'alto-adige.it',
      'altoadige.it',
      'an.it',
      'ancona.it',
      'andria-barletta-trani.it',
      'andria-trani-barletta.it',
      'andriabarlettatrani.it',
      'andriatranibarletta.it',
      'ao.it',
      'aosta.it',
      'aoste.it',
      'ap.it',
      'aq.it',
      'aquila.it',
      'ar.it',
      'arezzo.it',
      'ascoli-piceno.it',
      'ascolipiceno.it',
      'asti.it',
      'at.it',
      'av.it',
      'avellino.it',
      'ba.it',
      'balsan.it',
      'balsan-sudtirol.it',
      'balsan-s\xFCdtirol.it',
      'balsan-suedtirol.it',
      'bari.it',
      'barletta-trani-andria.it',
      'barlettatraniandria.it',
      'belluno.it',
      'benevento.it',
      'bergamo.it',
      'bg.it',
      'bi.it',
      'biella.it',
      'bl.it',
      'bn.it',
      'bo.it',
      'bologna.it',
      'bolzano.it',
      'bolzano-altoadige.it',
      'bozen.it',
      'bozen-sudtirol.it',
      'bozen-s\xFCdtirol.it',
      'bozen-suedtirol.it',
      'br.it',
      'brescia.it',
      'brindisi.it',
      'bs.it',
      'bt.it',
      'bulsan.it',
      'bulsan-sudtirol.it',
      'bulsan-s\xFCdtirol.it',
      'bulsan-suedtirol.it',
      'bz.it',
      'ca.it',
      'cagliari.it',
      'caltanissetta.it',
      'campidano-medio.it',
      'campidanomedio.it',
      'campobasso.it',
      'carbonia-iglesias.it',
      'carboniaiglesias.it',
      'carrara-massa.it',
      'carraramassa.it',
      'caserta.it',
      'catania.it',
      'catanzaro.it',
      'cb.it',
      'ce.it',
      'cesena-forli.it',
      'cesena-forl\xEC.it',
      'cesenaforli.it',
      'cesenaforl\xEC.it',
      'ch.it',
      'chieti.it',
      'ci.it',
      'cl.it',
      'cn.it',
      'co.it',
      'como.it',
      'cosenza.it',
      'cr.it',
      'cremona.it',
      'crotone.it',
      'cs.it',
      'ct.it',
      'cuneo.it',
      'cz.it',
      'dell-ogliastra.it',
      'dellogliastra.it',
      'en.it',
      'enna.it',
      'fc.it',
      'fe.it',
      'fermo.it',
      'ferrara.it',
      'fg.it',
      'fi.it',
      'firenze.it',
      'florence.it',
      'fm.it',
      'foggia.it',
      'forli-cesena.it',
      'forl\xEC-cesena.it',
      'forlicesena.it',
      'forl\xECcesena.it',
      'fr.it',
      'frosinone.it',
      'ge.it',
      'genoa.it',
      'genova.it',
      'go.it',
      'gorizia.it',
      'gr.it',
      'grosseto.it',
      'iglesias-carbonia.it',
      'iglesiascarbonia.it',
      'im.it',
      'imperia.it',
      'is.it',
      'isernia.it',
      'kr.it',
      'la-spezia.it',
      'laquila.it',
      'laspezia.it',
      'latina.it',
      'lc.it',
      'le.it',
      'lecce.it',
      'lecco.it',
      'li.it',
      'livorno.it',
      'lo.it',
      'lodi.it',
      'lt.it',
      'lu.it',
      'lucca.it',
      'macerata.it',
      'mantova.it',
      'massa-carrara.it',
      'massacarrara.it',
      'matera.it',
      'mb.it',
      'mc.it',
      'me.it',
      'medio-campidano.it',
      'mediocampidano.it',
      'messina.it',
      'mi.it',
      'milan.it',
      'milano.it',
      'mn.it',
      'mo.it',
      'modena.it',
      'monza.it',
      'monza-brianza.it',
      'monza-e-della-brianza.it',
      'monzabrianza.it',
      'monzaebrianza.it',
      'monzaedellabrianza.it',
      'ms.it',
      'mt.it',
      'na.it',
      'naples.it',
      'napoli.it',
      'no.it',
      'novara.it',
      'nu.it',
      'nuoro.it',
      'og.it',
      'ogliastra.it',
      'olbia-tempio.it',
      'olbiatempio.it',
      'or.it',
      'oristano.it',
      'ot.it',
      'pa.it',
      'padova.it',
      'padua.it',
      'palermo.it',
      'parma.it',
      'pavia.it',
      'pc.it',
      'pd.it',
      'pe.it',
      'perugia.it',
      'pesaro-urbino.it',
      'pesarourbino.it',
      'pescara.it',
      'pg.it',
      'pi.it',
      'piacenza.it',
      'pisa.it',
      'pistoia.it',
      'pn.it',
      'po.it',
      'pordenone.it',
      'potenza.it',
      'pr.it',
      'prato.it',
      'pt.it',
      'pu.it',
      'pv.it',
      'pz.it',
      'ra.it',
      'ragusa.it',
      'ravenna.it',
      'rc.it',
      're.it',
      'reggio-calabria.it',
      'reggio-emilia.it',
      'reggiocalabria.it',
      'reggioemilia.it',
      'rg.it',
      'ri.it',
      'rieti.it',
      'rimini.it',
      'rm.it',
      'rn.it',
      'ro.it',
      'roma.it',
      'rome.it',
      'rovigo.it',
      'sa.it',
      'salerno.it',
      'sassari.it',
      'savona.it',
      'si.it',
      'siena.it',
      'siracusa.it',
      'so.it',
      'sondrio.it',
      'sp.it',
      'sr.it',
      'ss.it',
      's\xFCdtirol.it',
      'suedtirol.it',
      'sv.it',
      'ta.it',
      'taranto.it',
      'te.it',
      'tempio-olbia.it',
      'tempioolbia.it',
      'teramo.it',
      'terni.it',
      'tn.it',
      'to.it',
      'torino.it',
      'tp.it',
      'tr.it',
      'trani-andria-barletta.it',
      'trani-barletta-andria.it',
      'traniandriabarletta.it',
      'tranibarlettaandria.it',
      'trapani.it',
      'trento.it',
      'treviso.it',
      'trieste.it',
      'ts.it',
      'turin.it',
      'tv.it',
      'ud.it',
      'udine.it',
      'urbino-pesaro.it',
      'urbinopesaro.it',
      'va.it',
      'varese.it',
      'vb.it',
      'vc.it',
      've.it',
      'venezia.it',
      'venice.it',
      'verbania.it',
      'vercelli.it',
      'verona.it',
      'vi.it',
      'vibo-valentia.it',
      'vibovalentia.it',
      'vicenza.it',
      'viterbo.it',
      'vr.it',
      'vs.it',
      'vt.it',
      'vv.it',
      'je',
      'co.je',
      'net.je',
      'org.je',
      '*.jm',
      'jo',
      'agri.jo',
      'ai.jo',
      'com.jo',
      'edu.jo',
      'eng.jo',
      'fm.jo',
      'gov.jo',
      'mil.jo',
      'net.jo',
      'org.jo',
      'per.jo',
      'phd.jo',
      'sch.jo',
      'tv.jo',
      'jobs',
      'jp',
      'ac.jp',
      'ad.jp',
      'co.jp',
      'ed.jp',
      'go.jp',
      'gr.jp',
      'lg.jp',
      'ne.jp',
      'or.jp',
      'aichi.jp',
      'akita.jp',
      'aomori.jp',
      'chiba.jp',
      'ehime.jp',
      'fukui.jp',
      'fukuoka.jp',
      'fukushima.jp',
      'gifu.jp',
      'gunma.jp',
      'hiroshima.jp',
      'hokkaido.jp',
      'hyogo.jp',
      'ibaraki.jp',
      'ishikawa.jp',
      'iwate.jp',
      'kagawa.jp',
      'kagoshima.jp',
      'kanagawa.jp',
      'kochi.jp',
      'kumamoto.jp',
      'kyoto.jp',
      'mie.jp',
      'miyagi.jp',
      'miyazaki.jp',
      'nagano.jp',
      'nagasaki.jp',
      'nara.jp',
      'niigata.jp',
      'oita.jp',
      'okayama.jp',
      'okinawa.jp',
      'osaka.jp',
      'saga.jp',
      'saitama.jp',
      'shiga.jp',
      'shimane.jp',
      'shizuoka.jp',
      'tochigi.jp',
      'tokushima.jp',
      'tokyo.jp',
      'tottori.jp',
      'toyama.jp',
      'wakayama.jp',
      'yamagata.jp',
      'yamaguchi.jp',
      'yamanashi.jp',
      '\u4E09\u91CD.jp',
      '\u4EAC\u90FD.jp',
      '\u4F50\u8CC0.jp',
      '\u5175\u5EAB.jp',
      '\u5317\u6D77\u9053.jp',
      '\u5343\u8449.jp',
      '\u548C\u6B4C\u5C71.jp',
      '\u57FC\u7389.jp',
      '\u5927\u5206.jp',
      '\u5927\u962A.jp',
      '\u5948\u826F.jp',
      '\u5BAE\u57CE.jp',
      '\u5BAE\u5D0E.jp',
      '\u5BCC\u5C71.jp',
      '\u5C71\u53E3.jp',
      '\u5C71\u5F62.jp',
      '\u5C71\u68A8.jp',
      '\u5C90\u961C.jp',
      '\u5CA1\u5C71.jp',
      '\u5CA9\u624B.jp',
      '\u5CF6\u6839.jp',
      '\u5E83\u5CF6.jp',
      '\u5FB3\u5CF6.jp',
      '\u611B\u5A9B.jp',
      '\u611B\u77E5.jp',
      '\u65B0\u6F5F.jp',
      '\u6771\u4EAC.jp',
      '\u6803\u6728.jp',
      '\u6C96\u7E04.jp',
      '\u6ECB\u8CC0.jp',
      '\u718A\u672C.jp',
      '\u77F3\u5DDD.jp',
      '\u795E\u5948\u5DDD.jp',
      '\u798F\u4E95.jp',
      '\u798F\u5CA1.jp',
      '\u798F\u5CF6.jp',
      '\u79CB\u7530.jp',
      '\u7FA4\u99AC.jp',
      '\u8328\u57CE.jp',
      '\u9577\u5D0E.jp',
      '\u9577\u91CE.jp',
      '\u9752\u68EE.jp',
      '\u9759\u5CA1.jp',
      '\u9999\u5DDD.jp',
      '\u9AD8\u77E5.jp',
      '\u9CE5\u53D6.jp',
      '\u9E7F\u5150\u5CF6.jp',
      '*.kawasaki.jp',
      '!city.kawasaki.jp',
      '*.kitakyushu.jp',
      '!city.kitakyushu.jp',
      '*.kobe.jp',
      '!city.kobe.jp',
      '*.nagoya.jp',
      '!city.nagoya.jp',
      '*.sapporo.jp',
      '!city.sapporo.jp',
      '*.sendai.jp',
      '!city.sendai.jp',
      '*.yokohama.jp',
      '!city.yokohama.jp',
      'aisai.aichi.jp',
      'ama.aichi.jp',
      'anjo.aichi.jp',
      'asuke.aichi.jp',
      'chiryu.aichi.jp',
      'chita.aichi.jp',
      'fuso.aichi.jp',
      'gamagori.aichi.jp',
      'handa.aichi.jp',
      'hazu.aichi.jp',
      'hekinan.aichi.jp',
      'higashiura.aichi.jp',
      'ichinomiya.aichi.jp',
      'inazawa.aichi.jp',
      'inuyama.aichi.jp',
      'isshiki.aichi.jp',
      'iwakura.aichi.jp',
      'kanie.aichi.jp',
      'kariya.aichi.jp',
      'kasugai.aichi.jp',
      'kira.aichi.jp',
      'kiyosu.aichi.jp',
      'komaki.aichi.jp',
      'konan.aichi.jp',
      'kota.aichi.jp',
      'mihama.aichi.jp',
      'miyoshi.aichi.jp',
      'nishio.aichi.jp',
      'nisshin.aichi.jp',
      'obu.aichi.jp',
      'oguchi.aichi.jp',
      'oharu.aichi.jp',
      'okazaki.aichi.jp',
      'owariasahi.aichi.jp',
      'seto.aichi.jp',
      'shikatsu.aichi.jp',
      'shinshiro.aichi.jp',
      'shitara.aichi.jp',
      'tahara.aichi.jp',
      'takahama.aichi.jp',
      'tobishima.aichi.jp',
      'toei.aichi.jp',
      'togo.aichi.jp',
      'tokai.aichi.jp',
      'tokoname.aichi.jp',
      'toyoake.aichi.jp',
      'toyohashi.aichi.jp',
      'toyokawa.aichi.jp',
      'toyone.aichi.jp',
      'toyota.aichi.jp',
      'tsushima.aichi.jp',
      'yatomi.aichi.jp',
      'akita.akita.jp',
      'daisen.akita.jp',
      'fujisato.akita.jp',
      'gojome.akita.jp',
      'hachirogata.akita.jp',
      'happou.akita.jp',
      'higashinaruse.akita.jp',
      'honjo.akita.jp',
      'honjyo.akita.jp',
      'ikawa.akita.jp',
      'kamikoani.akita.jp',
      'kamioka.akita.jp',
      'katagami.akita.jp',
      'kazuno.akita.jp',
      'kitaakita.akita.jp',
      'kosaka.akita.jp',
      'kyowa.akita.jp',
      'misato.akita.jp',
      'mitane.akita.jp',
      'moriyoshi.akita.jp',
      'nikaho.akita.jp',
      'noshiro.akita.jp',
      'odate.akita.jp',
      'oga.akita.jp',
      'ogata.akita.jp',
      'semboku.akita.jp',
      'yokote.akita.jp',
      'yurihonjo.akita.jp',
      'aomori.aomori.jp',
      'gonohe.aomori.jp',
      'hachinohe.aomori.jp',
      'hashikami.aomori.jp',
      'hiranai.aomori.jp',
      'hirosaki.aomori.jp',
      'itayanagi.aomori.jp',
      'kuroishi.aomori.jp',
      'misawa.aomori.jp',
      'mutsu.aomori.jp',
      'nakadomari.aomori.jp',
      'noheji.aomori.jp',
      'oirase.aomori.jp',
      'owani.aomori.jp',
      'rokunohe.aomori.jp',
      'sannohe.aomori.jp',
      'shichinohe.aomori.jp',
      'shingo.aomori.jp',
      'takko.aomori.jp',
      'towada.aomori.jp',
      'tsugaru.aomori.jp',
      'tsuruta.aomori.jp',
      'abiko.chiba.jp',
      'asahi.chiba.jp',
      'chonan.chiba.jp',
      'chosei.chiba.jp',
      'choshi.chiba.jp',
      'chuo.chiba.jp',
      'funabashi.chiba.jp',
      'futtsu.chiba.jp',
      'hanamigawa.chiba.jp',
      'ichihara.chiba.jp',
      'ichikawa.chiba.jp',
      'ichinomiya.chiba.jp',
      'inzai.chiba.jp',
      'isumi.chiba.jp',
      'kamagaya.chiba.jp',
      'kamogawa.chiba.jp',
      'kashiwa.chiba.jp',
      'katori.chiba.jp',
      'katsuura.chiba.jp',
      'kimitsu.chiba.jp',
      'kisarazu.chiba.jp',
      'kozaki.chiba.jp',
      'kujukuri.chiba.jp',
      'kyonan.chiba.jp',
      'matsudo.chiba.jp',
      'midori.chiba.jp',
      'mihama.chiba.jp',
      'minamiboso.chiba.jp',
      'mobara.chiba.jp',
      'mutsuzawa.chiba.jp',
      'nagara.chiba.jp',
      'nagareyama.chiba.jp',
      'narashino.chiba.jp',
      'narita.chiba.jp',
      'noda.chiba.jp',
      'oamishirasato.chiba.jp',
      'omigawa.chiba.jp',
      'onjuku.chiba.jp',
      'otaki.chiba.jp',
      'sakae.chiba.jp',
      'sakura.chiba.jp',
      'shimofusa.chiba.jp',
      'shirako.chiba.jp',
      'shiroi.chiba.jp',
      'shisui.chiba.jp',
      'sodegaura.chiba.jp',
      'sosa.chiba.jp',
      'tako.chiba.jp',
      'tateyama.chiba.jp',
      'togane.chiba.jp',
      'tohnosho.chiba.jp',
      'tomisato.chiba.jp',
      'urayasu.chiba.jp',
      'yachimata.chiba.jp',
      'yachiyo.chiba.jp',
      'yokaichiba.chiba.jp',
      'yokoshibahikari.chiba.jp',
      'yotsukaido.chiba.jp',
      'ainan.ehime.jp',
      'honai.ehime.jp',
      'ikata.ehime.jp',
      'imabari.ehime.jp',
      'iyo.ehime.jp',
      'kamijima.ehime.jp',
      'kihoku.ehime.jp',
      'kumakogen.ehime.jp',
      'masaki.ehime.jp',
      'matsuno.ehime.jp',
      'matsuyama.ehime.jp',
      'namikata.ehime.jp',
      'niihama.ehime.jp',
      'ozu.ehime.jp',
      'saijo.ehime.jp',
      'seiyo.ehime.jp',
      'shikokuchuo.ehime.jp',
      'tobe.ehime.jp',
      'toon.ehime.jp',
      'uchiko.ehime.jp',
      'uwajima.ehime.jp',
      'yawatahama.ehime.jp',
      'echizen.fukui.jp',
      'eiheiji.fukui.jp',
      'fukui.fukui.jp',
      'ikeda.fukui.jp',
      'katsuyama.fukui.jp',
      'mihama.fukui.jp',
      'minamiechizen.fukui.jp',
      'obama.fukui.jp',
      'ohi.fukui.jp',
      'ono.fukui.jp',
      'sabae.fukui.jp',
      'sakai.fukui.jp',
      'takahama.fukui.jp',
      'tsuruga.fukui.jp',
      'wakasa.fukui.jp',
      'ashiya.fukuoka.jp',
      'buzen.fukuoka.jp',
      'chikugo.fukuoka.jp',
      'chikuho.fukuoka.jp',
      'chikujo.fukuoka.jp',
      'chikushino.fukuoka.jp',
      'chikuzen.fukuoka.jp',
      'chuo.fukuoka.jp',
      'dazaifu.fukuoka.jp',
      'fukuchi.fukuoka.jp',
      'hakata.fukuoka.jp',
      'higashi.fukuoka.jp',
      'hirokawa.fukuoka.jp',
      'hisayama.fukuoka.jp',
      'iizuka.fukuoka.jp',
      'inatsuki.fukuoka.jp',
      'kaho.fukuoka.jp',
      'kasuga.fukuoka.jp',
      'kasuya.fukuoka.jp',
      'kawara.fukuoka.jp',
      'keisen.fukuoka.jp',
      'koga.fukuoka.jp',
      'kurate.fukuoka.jp',
      'kurogi.fukuoka.jp',
      'kurume.fukuoka.jp',
      'minami.fukuoka.jp',
      'miyako.fukuoka.jp',
      'miyama.fukuoka.jp',
      'miyawaka.fukuoka.jp',
      'mizumaki.fukuoka.jp',
      'munakata.fukuoka.jp',
      'nakagawa.fukuoka.jp',
      'nakama.fukuoka.jp',
      'nishi.fukuoka.jp',
      'nogata.fukuoka.jp',
      'ogori.fukuoka.jp',
      'okagaki.fukuoka.jp',
      'okawa.fukuoka.jp',
      'oki.fukuoka.jp',
      'omuta.fukuoka.jp',
      'onga.fukuoka.jp',
      'onojo.fukuoka.jp',
      'oto.fukuoka.jp',
      'saigawa.fukuoka.jp',
      'sasaguri.fukuoka.jp',
      'shingu.fukuoka.jp',
      'shinyoshitomi.fukuoka.jp',
      'shonai.fukuoka.jp',
      'soeda.fukuoka.jp',
      'sue.fukuoka.jp',
      'tachiarai.fukuoka.jp',
      'tagawa.fukuoka.jp',
      'takata.fukuoka.jp',
      'toho.fukuoka.jp',
      'toyotsu.fukuoka.jp',
      'tsuiki.fukuoka.jp',
      'ukiha.fukuoka.jp',
      'umi.fukuoka.jp',
      'usui.fukuoka.jp',
      'yamada.fukuoka.jp',
      'yame.fukuoka.jp',
      'yanagawa.fukuoka.jp',
      'yukuhashi.fukuoka.jp',
      'aizubange.fukushima.jp',
      'aizumisato.fukushima.jp',
      'aizuwakamatsu.fukushima.jp',
      'asakawa.fukushima.jp',
      'bandai.fukushima.jp',
      'date.fukushima.jp',
      'fukushima.fukushima.jp',
      'furudono.fukushima.jp',
      'futaba.fukushima.jp',
      'hanawa.fukushima.jp',
      'higashi.fukushima.jp',
      'hirata.fukushima.jp',
      'hirono.fukushima.jp',
      'iitate.fukushima.jp',
      'inawashiro.fukushima.jp',
      'ishikawa.fukushima.jp',
      'iwaki.fukushima.jp',
      'izumizaki.fukushima.jp',
      'kagamiishi.fukushima.jp',
      'kaneyama.fukushima.jp',
      'kawamata.fukushima.jp',
      'kitakata.fukushima.jp',
      'kitashiobara.fukushima.jp',
      'koori.fukushima.jp',
      'koriyama.fukushima.jp',
      'kunimi.fukushima.jp',
      'miharu.fukushima.jp',
      'mishima.fukushima.jp',
      'namie.fukushima.jp',
      'nango.fukushima.jp',
      'nishiaizu.fukushima.jp',
      'nishigo.fukushima.jp',
      'okuma.fukushima.jp',
      'omotego.fukushima.jp',
      'ono.fukushima.jp',
      'otama.fukushima.jp',
      'samegawa.fukushima.jp',
      'shimogo.fukushima.jp',
      'shirakawa.fukushima.jp',
      'showa.fukushima.jp',
      'soma.fukushima.jp',
      'sukagawa.fukushima.jp',
      'taishin.fukushima.jp',
      'tamakawa.fukushima.jp',
      'tanagura.fukushima.jp',
      'tenei.fukushima.jp',
      'yabuki.fukushima.jp',
      'yamato.fukushima.jp',
      'yamatsuri.fukushima.jp',
      'yanaizu.fukushima.jp',
      'yugawa.fukushima.jp',
      'anpachi.gifu.jp',
      'ena.gifu.jp',
      'gifu.gifu.jp',
      'ginan.gifu.jp',
      'godo.gifu.jp',
      'gujo.gifu.jp',
      'hashima.gifu.jp',
      'hichiso.gifu.jp',
      'hida.gifu.jp',
      'higashishirakawa.gifu.jp',
      'ibigawa.gifu.jp',
      'ikeda.gifu.jp',
      'kakamigahara.gifu.jp',
      'kani.gifu.jp',
      'kasahara.gifu.jp',
      'kasamatsu.gifu.jp',
      'kawaue.gifu.jp',
      'kitagata.gifu.jp',
      'mino.gifu.jp',
      'minokamo.gifu.jp',
      'mitake.gifu.jp',
      'mizunami.gifu.jp',
      'motosu.gifu.jp',
      'nakatsugawa.gifu.jp',
      'ogaki.gifu.jp',
      'sakahogi.gifu.jp',
      'seki.gifu.jp',
      'sekigahara.gifu.jp',
      'shirakawa.gifu.jp',
      'tajimi.gifu.jp',
      'takayama.gifu.jp',
      'tarui.gifu.jp',
      'toki.gifu.jp',
      'tomika.gifu.jp',
      'wanouchi.gifu.jp',
      'yamagata.gifu.jp',
      'yaotsu.gifu.jp',
      'yoro.gifu.jp',
      'annaka.gunma.jp',
      'chiyoda.gunma.jp',
      'fujioka.gunma.jp',
      'higashiagatsuma.gunma.jp',
      'isesaki.gunma.jp',
      'itakura.gunma.jp',
      'kanna.gunma.jp',
      'kanra.gunma.jp',
      'katashina.gunma.jp',
      'kawaba.gunma.jp',
      'kiryu.gunma.jp',
      'kusatsu.gunma.jp',
      'maebashi.gunma.jp',
      'meiwa.gunma.jp',
      'midori.gunma.jp',
      'minakami.gunma.jp',
      'naganohara.gunma.jp',
      'nakanojo.gunma.jp',
      'nanmoku.gunma.jp',
      'numata.gunma.jp',
      'oizumi.gunma.jp',
      'ora.gunma.jp',
      'ota.gunma.jp',
      'shibukawa.gunma.jp',
      'shimonita.gunma.jp',
      'shinto.gunma.jp',
      'showa.gunma.jp',
      'takasaki.gunma.jp',
      'takayama.gunma.jp',
      'tamamura.gunma.jp',
      'tatebayashi.gunma.jp',
      'tomioka.gunma.jp',
      'tsukiyono.gunma.jp',
      'tsumagoi.gunma.jp',
      'ueno.gunma.jp',
      'yoshioka.gunma.jp',
      'asaminami.hiroshima.jp',
      'daiwa.hiroshima.jp',
      'etajima.hiroshima.jp',
      'fuchu.hiroshima.jp',
      'fukuyama.hiroshima.jp',
      'hatsukaichi.hiroshima.jp',
      'higashihiroshima.hiroshima.jp',
      'hongo.hiroshima.jp',
      'jinsekikogen.hiroshima.jp',
      'kaita.hiroshima.jp',
      'kui.hiroshima.jp',
      'kumano.hiroshima.jp',
      'kure.hiroshima.jp',
      'mihara.hiroshima.jp',
      'miyoshi.hiroshima.jp',
      'naka.hiroshima.jp',
      'onomichi.hiroshima.jp',
      'osakikamijima.hiroshima.jp',
      'otake.hiroshima.jp',
      'saka.hiroshima.jp',
      'sera.hiroshima.jp',
      'seranishi.hiroshima.jp',
      'shinichi.hiroshima.jp',
      'shobara.hiroshima.jp',
      'takehara.hiroshima.jp',
      'abashiri.hokkaido.jp',
      'abira.hokkaido.jp',
      'aibetsu.hokkaido.jp',
      'akabira.hokkaido.jp',
      'akkeshi.hokkaido.jp',
      'asahikawa.hokkaido.jp',
      'ashibetsu.hokkaido.jp',
      'ashoro.hokkaido.jp',
      'assabu.hokkaido.jp',
      'atsuma.hokkaido.jp',
      'bibai.hokkaido.jp',
      'biei.hokkaido.jp',
      'bifuka.hokkaido.jp',
      'bihoro.hokkaido.jp',
      'biratori.hokkaido.jp',
      'chippubetsu.hokkaido.jp',
      'chitose.hokkaido.jp',
      'date.hokkaido.jp',
      'ebetsu.hokkaido.jp',
      'embetsu.hokkaido.jp',
      'eniwa.hokkaido.jp',
      'erimo.hokkaido.jp',
      'esan.hokkaido.jp',
      'esashi.hokkaido.jp',
      'fukagawa.hokkaido.jp',
      'fukushima.hokkaido.jp',
      'furano.hokkaido.jp',
      'furubira.hokkaido.jp',
      'haboro.hokkaido.jp',
      'hakodate.hokkaido.jp',
      'hamatonbetsu.hokkaido.jp',
      'hidaka.hokkaido.jp',
      'higashikagura.hokkaido.jp',
      'higashikawa.hokkaido.jp',
      'hiroo.hokkaido.jp',
      'hokuryu.hokkaido.jp',
      'hokuto.hokkaido.jp',
      'honbetsu.hokkaido.jp',
      'horokanai.hokkaido.jp',
      'horonobe.hokkaido.jp',
      'ikeda.hokkaido.jp',
      'imakane.hokkaido.jp',
      'ishikari.hokkaido.jp',
      'iwamizawa.hokkaido.jp',
      'iwanai.hokkaido.jp',
      'kamifurano.hokkaido.jp',
      'kamikawa.hokkaido.jp',
      'kamishihoro.hokkaido.jp',
      'kamisunagawa.hokkaido.jp',
      'kamoenai.hokkaido.jp',
      'kayabe.hokkaido.jp',
      'kembuchi.hokkaido.jp',
      'kikonai.hokkaido.jp',
      'kimobetsu.hokkaido.jp',
      'kitahiroshima.hokkaido.jp',
      'kitami.hokkaido.jp',
      'kiyosato.hokkaido.jp',
      'koshimizu.hokkaido.jp',
      'kunneppu.hokkaido.jp',
      'kuriyama.hokkaido.jp',
      'kuromatsunai.hokkaido.jp',
      'kushiro.hokkaido.jp',
      'kutchan.hokkaido.jp',
      'kyowa.hokkaido.jp',
      'mashike.hokkaido.jp',
      'matsumae.hokkaido.jp',
      'mikasa.hokkaido.jp',
      'minamifurano.hokkaido.jp',
      'mombetsu.hokkaido.jp',
      'moseushi.hokkaido.jp',
      'mukawa.hokkaido.jp',
      'muroran.hokkaido.jp',
      'naie.hokkaido.jp',
      'nakagawa.hokkaido.jp',
      'nakasatsunai.hokkaido.jp',
      'nakatombetsu.hokkaido.jp',
      'nanae.hokkaido.jp',
      'nanporo.hokkaido.jp',
      'nayoro.hokkaido.jp',
      'nemuro.hokkaido.jp',
      'niikappu.hokkaido.jp',
      'niki.hokkaido.jp',
      'nishiokoppe.hokkaido.jp',
      'noboribetsu.hokkaido.jp',
      'numata.hokkaido.jp',
      'obihiro.hokkaido.jp',
      'obira.hokkaido.jp',
      'oketo.hokkaido.jp',
      'okoppe.hokkaido.jp',
      'otaru.hokkaido.jp',
      'otobe.hokkaido.jp',
      'otofuke.hokkaido.jp',
      'otoineppu.hokkaido.jp',
      'oumu.hokkaido.jp',
      'ozora.hokkaido.jp',
      'pippu.hokkaido.jp',
      'rankoshi.hokkaido.jp',
      'rebun.hokkaido.jp',
      'rikubetsu.hokkaido.jp',
      'rishiri.hokkaido.jp',
      'rishirifuji.hokkaido.jp',
      'saroma.hokkaido.jp',
      'sarufutsu.hokkaido.jp',
      'shakotan.hokkaido.jp',
      'shari.hokkaido.jp',
      'shibecha.hokkaido.jp',
      'shibetsu.hokkaido.jp',
      'shikabe.hokkaido.jp',
      'shikaoi.hokkaido.jp',
      'shimamaki.hokkaido.jp',
      'shimizu.hokkaido.jp',
      'shimokawa.hokkaido.jp',
      'shinshinotsu.hokkaido.jp',
      'shintoku.hokkaido.jp',
      'shiranuka.hokkaido.jp',
      'shiraoi.hokkaido.jp',
      'shiriuchi.hokkaido.jp',
      'sobetsu.hokkaido.jp',
      'sunagawa.hokkaido.jp',
      'taiki.hokkaido.jp',
      'takasu.hokkaido.jp',
      'takikawa.hokkaido.jp',
      'takinoue.hokkaido.jp',
      'teshikaga.hokkaido.jp',
      'tobetsu.hokkaido.jp',
      'tohma.hokkaido.jp',
      'tomakomai.hokkaido.jp',
      'tomari.hokkaido.jp',
      'toya.hokkaido.jp',
      'toyako.hokkaido.jp',
      'toyotomi.hokkaido.jp',
      'toyoura.hokkaido.jp',
      'tsubetsu.hokkaido.jp',
      'tsukigata.hokkaido.jp',
      'urakawa.hokkaido.jp',
      'urausu.hokkaido.jp',
      'uryu.hokkaido.jp',
      'utashinai.hokkaido.jp',
      'wakkanai.hokkaido.jp',
      'wassamu.hokkaido.jp',
      'yakumo.hokkaido.jp',
      'yoichi.hokkaido.jp',
      'aioi.hyogo.jp',
      'akashi.hyogo.jp',
      'ako.hyogo.jp',
      'amagasaki.hyogo.jp',
      'aogaki.hyogo.jp',
      'asago.hyogo.jp',
      'ashiya.hyogo.jp',
      'awaji.hyogo.jp',
      'fukusaki.hyogo.jp',
      'goshiki.hyogo.jp',
      'harima.hyogo.jp',
      'himeji.hyogo.jp',
      'ichikawa.hyogo.jp',
      'inagawa.hyogo.jp',
      'itami.hyogo.jp',
      'kakogawa.hyogo.jp',
      'kamigori.hyogo.jp',
      'kamikawa.hyogo.jp',
      'kasai.hyogo.jp',
      'kasuga.hyogo.jp',
      'kawanishi.hyogo.jp',
      'miki.hyogo.jp',
      'minamiawaji.hyogo.jp',
      'nishinomiya.hyogo.jp',
      'nishiwaki.hyogo.jp',
      'ono.hyogo.jp',
      'sanda.hyogo.jp',
      'sannan.hyogo.jp',
      'sasayama.hyogo.jp',
      'sayo.hyogo.jp',
      'shingu.hyogo.jp',
      'shinonsen.hyogo.jp',
      'shiso.hyogo.jp',
      'sumoto.hyogo.jp',
      'taishi.hyogo.jp',
      'taka.hyogo.jp',
      'takarazuka.hyogo.jp',
      'takasago.hyogo.jp',
      'takino.hyogo.jp',
      'tamba.hyogo.jp',
      'tatsuno.hyogo.jp',
      'toyooka.hyogo.jp',
      'yabu.hyogo.jp',
      'yashiro.hyogo.jp',
      'yoka.hyogo.jp',
      'yokawa.hyogo.jp',
      'ami.ibaraki.jp',
      'asahi.ibaraki.jp',
      'bando.ibaraki.jp',
      'chikusei.ibaraki.jp',
      'daigo.ibaraki.jp',
      'fujishiro.ibaraki.jp',
      'hitachi.ibaraki.jp',
      'hitachinaka.ibaraki.jp',
      'hitachiomiya.ibaraki.jp',
      'hitachiota.ibaraki.jp',
      'ibaraki.ibaraki.jp',
      'ina.ibaraki.jp',
      'inashiki.ibaraki.jp',
      'itako.ibaraki.jp',
      'iwama.ibaraki.jp',
      'joso.ibaraki.jp',
      'kamisu.ibaraki.jp',
      'kasama.ibaraki.jp',
      'kashima.ibaraki.jp',
      'kasumigaura.ibaraki.jp',
      'koga.ibaraki.jp',
      'miho.ibaraki.jp',
      'mito.ibaraki.jp',
      'moriya.ibaraki.jp',
      'naka.ibaraki.jp',
      'namegata.ibaraki.jp',
      'oarai.ibaraki.jp',
      'ogawa.ibaraki.jp',
      'omitama.ibaraki.jp',
      'ryugasaki.ibaraki.jp',
      'sakai.ibaraki.jp',
      'sakuragawa.ibaraki.jp',
      'shimodate.ibaraki.jp',
      'shimotsuma.ibaraki.jp',
      'shirosato.ibaraki.jp',
      'sowa.ibaraki.jp',
      'suifu.ibaraki.jp',
      'takahagi.ibaraki.jp',
      'tamatsukuri.ibaraki.jp',
      'tokai.ibaraki.jp',
      'tomobe.ibaraki.jp',
      'tone.ibaraki.jp',
      'toride.ibaraki.jp',
      'tsuchiura.ibaraki.jp',
      'tsukuba.ibaraki.jp',
      'uchihara.ibaraki.jp',
      'ushiku.ibaraki.jp',
      'yachiyo.ibaraki.jp',
      'yamagata.ibaraki.jp',
      'yawara.ibaraki.jp',
      'yuki.ibaraki.jp',
      'anamizu.ishikawa.jp',
      'hakui.ishikawa.jp',
      'hakusan.ishikawa.jp',
      'kaga.ishikawa.jp',
      'kahoku.ishikawa.jp',
      'kanazawa.ishikawa.jp',
      'kawakita.ishikawa.jp',
      'komatsu.ishikawa.jp',
      'nakanoto.ishikawa.jp',
      'nanao.ishikawa.jp',
      'nomi.ishikawa.jp',
      'nonoichi.ishikawa.jp',
      'noto.ishikawa.jp',
      'shika.ishikawa.jp',
      'suzu.ishikawa.jp',
      'tsubata.ishikawa.jp',
      'tsurugi.ishikawa.jp',
      'uchinada.ishikawa.jp',
      'wajima.ishikawa.jp',
      'fudai.iwate.jp',
      'fujisawa.iwate.jp',
      'hanamaki.iwate.jp',
      'hiraizumi.iwate.jp',
      'hirono.iwate.jp',
      'ichinohe.iwate.jp',
      'ichinoseki.iwate.jp',
      'iwaizumi.iwate.jp',
      'iwate.iwate.jp',
      'joboji.iwate.jp',
      'kamaishi.iwate.jp',
      'kanegasaki.iwate.jp',
      'karumai.iwate.jp',
      'kawai.iwate.jp',
      'kitakami.iwate.jp',
      'kuji.iwate.jp',
      'kunohe.iwate.jp',
      'kuzumaki.iwate.jp',
      'miyako.iwate.jp',
      'mizusawa.iwate.jp',
      'morioka.iwate.jp',
      'ninohe.iwate.jp',
      'noda.iwate.jp',
      'ofunato.iwate.jp',
      'oshu.iwate.jp',
      'otsuchi.iwate.jp',
      'rikuzentakata.iwate.jp',
      'shiwa.iwate.jp',
      'shizukuishi.iwate.jp',
      'sumita.iwate.jp',
      'tanohata.iwate.jp',
      'tono.iwate.jp',
      'yahaba.iwate.jp',
      'yamada.iwate.jp',
      'ayagawa.kagawa.jp',
      'higashikagawa.kagawa.jp',
      'kanonji.kagawa.jp',
      'kotohira.kagawa.jp',
      'manno.kagawa.jp',
      'marugame.kagawa.jp',
      'mitoyo.kagawa.jp',
      'naoshima.kagawa.jp',
      'sanuki.kagawa.jp',
      'tadotsu.kagawa.jp',
      'takamatsu.kagawa.jp',
      'tonosho.kagawa.jp',
      'uchinomi.kagawa.jp',
      'utazu.kagawa.jp',
      'zentsuji.kagawa.jp',
      'akune.kagoshima.jp',
      'amami.kagoshima.jp',
      'hioki.kagoshima.jp',
      'isa.kagoshima.jp',
      'isen.kagoshima.jp',
      'izumi.kagoshima.jp',
      'kagoshima.kagoshima.jp',
      'kanoya.kagoshima.jp',
      'kawanabe.kagoshima.jp',
      'kinko.kagoshima.jp',
      'kouyama.kagoshima.jp',
      'makurazaki.kagoshima.jp',
      'matsumoto.kagoshima.jp',
      'minamitane.kagoshima.jp',
      'nakatane.kagoshima.jp',
      'nishinoomote.kagoshima.jp',
      'satsumasendai.kagoshima.jp',
      'soo.kagoshima.jp',
      'tarumizu.kagoshima.jp',
      'yusui.kagoshima.jp',
      'aikawa.kanagawa.jp',
      'atsugi.kanagawa.jp',
      'ayase.kanagawa.jp',
      'chigasaki.kanagawa.jp',
      'ebina.kanagawa.jp',
      'fujisawa.kanagawa.jp',
      'hadano.kanagawa.jp',
      'hakone.kanagawa.jp',
      'hiratsuka.kanagawa.jp',
      'isehara.kanagawa.jp',
      'kaisei.kanagawa.jp',
      'kamakura.kanagawa.jp',
      'kiyokawa.kanagawa.jp',
      'matsuda.kanagawa.jp',
      'minamiashigara.kanagawa.jp',
      'miura.kanagawa.jp',
      'nakai.kanagawa.jp',
      'ninomiya.kanagawa.jp',
      'odawara.kanagawa.jp',
      'oi.kanagawa.jp',
      'oiso.kanagawa.jp',
      'sagamihara.kanagawa.jp',
      'samukawa.kanagawa.jp',
      'tsukui.kanagawa.jp',
      'yamakita.kanagawa.jp',
      'yamato.kanagawa.jp',
      'yokosuka.kanagawa.jp',
      'yugawara.kanagawa.jp',
      'zama.kanagawa.jp',
      'zushi.kanagawa.jp',
      'aki.kochi.jp',
      'geisei.kochi.jp',
      'hidaka.kochi.jp',
      'higashitsuno.kochi.jp',
      'ino.kochi.jp',
      'kagami.kochi.jp',
      'kami.kochi.jp',
      'kitagawa.kochi.jp',
      'kochi.kochi.jp',
      'mihara.kochi.jp',
      'motoyama.kochi.jp',
      'muroto.kochi.jp',
      'nahari.kochi.jp',
      'nakamura.kochi.jp',
      'nankoku.kochi.jp',
      'nishitosa.kochi.jp',
      'niyodogawa.kochi.jp',
      'ochi.kochi.jp',
      'okawa.kochi.jp',
      'otoyo.kochi.jp',
      'otsuki.kochi.jp',
      'sakawa.kochi.jp',
      'sukumo.kochi.jp',
      'susaki.kochi.jp',
      'tosa.kochi.jp',
      'tosashimizu.kochi.jp',
      'toyo.kochi.jp',
      'tsuno.kochi.jp',
      'umaji.kochi.jp',
      'yasuda.kochi.jp',
      'yusuhara.kochi.jp',
      'amakusa.kumamoto.jp',
      'arao.kumamoto.jp',
      'aso.kumamoto.jp',
      'choyo.kumamoto.jp',
      'gyokuto.kumamoto.jp',
      'kamiamakusa.kumamoto.jp',
      'kikuchi.kumamoto.jp',
      'kumamoto.kumamoto.jp',
      'mashiki.kumamoto.jp',
      'mifune.kumamoto.jp',
      'minamata.kumamoto.jp',
      'minamioguni.kumamoto.jp',
      'nagasu.kumamoto.jp',
      'nishihara.kumamoto.jp',
      'oguni.kumamoto.jp',
      'ozu.kumamoto.jp',
      'sumoto.kumamoto.jp',
      'takamori.kumamoto.jp',
      'uki.kumamoto.jp',
      'uto.kumamoto.jp',
      'yamaga.kumamoto.jp',
      'yamato.kumamoto.jp',
      'yatsushiro.kumamoto.jp',
      'ayabe.kyoto.jp',
      'fukuchiyama.kyoto.jp',
      'higashiyama.kyoto.jp',
      'ide.kyoto.jp',
      'ine.kyoto.jp',
      'joyo.kyoto.jp',
      'kameoka.kyoto.jp',
      'kamo.kyoto.jp',
      'kita.kyoto.jp',
      'kizu.kyoto.jp',
      'kumiyama.kyoto.jp',
      'kyotamba.kyoto.jp',
      'kyotanabe.kyoto.jp',
      'kyotango.kyoto.jp',
      'maizuru.kyoto.jp',
      'minami.kyoto.jp',
      'minamiyamashiro.kyoto.jp',
      'miyazu.kyoto.jp',
      'muko.kyoto.jp',
      'nagaokakyo.kyoto.jp',
      'nakagyo.kyoto.jp',
      'nantan.kyoto.jp',
      'oyamazaki.kyoto.jp',
      'sakyo.kyoto.jp',
      'seika.kyoto.jp',
      'tanabe.kyoto.jp',
      'uji.kyoto.jp',
      'ujitawara.kyoto.jp',
      'wazuka.kyoto.jp',
      'yamashina.kyoto.jp',
      'yawata.kyoto.jp',
      'asahi.mie.jp',
      'inabe.mie.jp',
      'ise.mie.jp',
      'kameyama.mie.jp',
      'kawagoe.mie.jp',
      'kiho.mie.jp',
      'kisosaki.mie.jp',
      'kiwa.mie.jp',
      'komono.mie.jp',
      'kumano.mie.jp',
      'kuwana.mie.jp',
      'matsusaka.mie.jp',
      'meiwa.mie.jp',
      'mihama.mie.jp',
      'minamiise.mie.jp',
      'misugi.mie.jp',
      'miyama.mie.jp',
      'nabari.mie.jp',
      'shima.mie.jp',
      'suzuka.mie.jp',
      'tado.mie.jp',
      'taiki.mie.jp',
      'taki.mie.jp',
      'tamaki.mie.jp',
      'toba.mie.jp',
      'tsu.mie.jp',
      'udono.mie.jp',
      'ureshino.mie.jp',
      'watarai.mie.jp',
      'yokkaichi.mie.jp',
      'furukawa.miyagi.jp',
      'higashimatsushima.miyagi.jp',
      'ishinomaki.miyagi.jp',
      'iwanuma.miyagi.jp',
      'kakuda.miyagi.jp',
      'kami.miyagi.jp',
      'kawasaki.miyagi.jp',
      'marumori.miyagi.jp',
      'matsushima.miyagi.jp',
      'minamisanriku.miyagi.jp',
      'misato.miyagi.jp',
      'murata.miyagi.jp',
      'natori.miyagi.jp',
      'ogawara.miyagi.jp',
      'ohira.miyagi.jp',
      'onagawa.miyagi.jp',
      'osaki.miyagi.jp',
      'rifu.miyagi.jp',
      'semine.miyagi.jp',
      'shibata.miyagi.jp',
      'shichikashuku.miyagi.jp',
      'shikama.miyagi.jp',
      'shiogama.miyagi.jp',
      'shiroishi.miyagi.jp',
      'tagajo.miyagi.jp',
      'taiwa.miyagi.jp',
      'tome.miyagi.jp',
      'tomiya.miyagi.jp',
      'wakuya.miyagi.jp',
      'watari.miyagi.jp',
      'yamamoto.miyagi.jp',
      'zao.miyagi.jp',
      'aya.miyazaki.jp',
      'ebino.miyazaki.jp',
      'gokase.miyazaki.jp',
      'hyuga.miyazaki.jp',
      'kadogawa.miyazaki.jp',
      'kawaminami.miyazaki.jp',
      'kijo.miyazaki.jp',
      'kitagawa.miyazaki.jp',
      'kitakata.miyazaki.jp',
      'kitaura.miyazaki.jp',
      'kobayashi.miyazaki.jp',
      'kunitomi.miyazaki.jp',
      'kushima.miyazaki.jp',
      'mimata.miyazaki.jp',
      'miyakonojo.miyazaki.jp',
      'miyazaki.miyazaki.jp',
      'morotsuka.miyazaki.jp',
      'nichinan.miyazaki.jp',
      'nishimera.miyazaki.jp',
      'nobeoka.miyazaki.jp',
      'saito.miyazaki.jp',
      'shiiba.miyazaki.jp',
      'shintomi.miyazaki.jp',
      'takaharu.miyazaki.jp',
      'takanabe.miyazaki.jp',
      'takazaki.miyazaki.jp',
      'tsuno.miyazaki.jp',
      'achi.nagano.jp',
      'agematsu.nagano.jp',
      'anan.nagano.jp',
      'aoki.nagano.jp',
      'asahi.nagano.jp',
      'azumino.nagano.jp',
      'chikuhoku.nagano.jp',
      'chikuma.nagano.jp',
      'chino.nagano.jp',
      'fujimi.nagano.jp',
      'hakuba.nagano.jp',
      'hara.nagano.jp',
      'hiraya.nagano.jp',
      'iida.nagano.jp',
      'iijima.nagano.jp',
      'iiyama.nagano.jp',
      'iizuna.nagano.jp',
      'ikeda.nagano.jp',
      'ikusaka.nagano.jp',
      'ina.nagano.jp',
      'karuizawa.nagano.jp',
      'kawakami.nagano.jp',
      'kiso.nagano.jp',
      'kisofukushima.nagano.jp',
      'kitaaiki.nagano.jp',
      'komagane.nagano.jp',
      'komoro.nagano.jp',
      'matsukawa.nagano.jp',
      'matsumoto.nagano.jp',
      'miasa.nagano.jp',
      'minamiaiki.nagano.jp',
      'minamimaki.nagano.jp',
      'minamiminowa.nagano.jp',
      'minowa.nagano.jp',
      'miyada.nagano.jp',
      'miyota.nagano.jp',
      'mochizuki.nagano.jp',
      'nagano.nagano.jp',
      'nagawa.nagano.jp',
      'nagiso.nagano.jp',
      'nakagawa.nagano.jp',
      'nakano.nagano.jp',
      'nozawaonsen.nagano.jp',
      'obuse.nagano.jp',
      'ogawa.nagano.jp',
      'okaya.nagano.jp',
      'omachi.nagano.jp',
      'omi.nagano.jp',
      'ookuwa.nagano.jp',
      'ooshika.nagano.jp',
      'otaki.nagano.jp',
      'otari.nagano.jp',
      'sakae.nagano.jp',
      'sakaki.nagano.jp',
      'saku.nagano.jp',
      'sakuho.nagano.jp',
      'shimosuwa.nagano.jp',
      'shinanomachi.nagano.jp',
      'shiojiri.nagano.jp',
      'suwa.nagano.jp',
      'suzaka.nagano.jp',
      'takagi.nagano.jp',
      'takamori.nagano.jp',
      'takayama.nagano.jp',
      'tateshina.nagano.jp',
      'tatsuno.nagano.jp',
      'togakushi.nagano.jp',
      'togura.nagano.jp',
      'tomi.nagano.jp',
      'ueda.nagano.jp',
      'wada.nagano.jp',
      'yamagata.nagano.jp',
      'yamanouchi.nagano.jp',
      'yasaka.nagano.jp',
      'yasuoka.nagano.jp',
      'chijiwa.nagasaki.jp',
      'futsu.nagasaki.jp',
      'goto.nagasaki.jp',
      'hasami.nagasaki.jp',
      'hirado.nagasaki.jp',
      'iki.nagasaki.jp',
      'isahaya.nagasaki.jp',
      'kawatana.nagasaki.jp',
      'kuchinotsu.nagasaki.jp',
      'matsuura.nagasaki.jp',
      'nagasaki.nagasaki.jp',
      'obama.nagasaki.jp',
      'omura.nagasaki.jp',
      'oseto.nagasaki.jp',
      'saikai.nagasaki.jp',
      'sasebo.nagasaki.jp',
      'seihi.nagasaki.jp',
      'shimabara.nagasaki.jp',
      'shinkamigoto.nagasaki.jp',
      'togitsu.nagasaki.jp',
      'tsushima.nagasaki.jp',
      'unzen.nagasaki.jp',
      'ando.nara.jp',
      'gose.nara.jp',
      'heguri.nara.jp',
      'higashiyoshino.nara.jp',
      'ikaruga.nara.jp',
      'ikoma.nara.jp',
      'kamikitayama.nara.jp',
      'kanmaki.nara.jp',
      'kashiba.nara.jp',
      'kashihara.nara.jp',
      'katsuragi.nara.jp',
      'kawai.nara.jp',
      'kawakami.nara.jp',
      'kawanishi.nara.jp',
      'koryo.nara.jp',
      'kurotaki.nara.jp',
      'mitsue.nara.jp',
      'miyake.nara.jp',
      'nara.nara.jp',
      'nosegawa.nara.jp',
      'oji.nara.jp',
      'ouda.nara.jp',
      'oyodo.nara.jp',
      'sakurai.nara.jp',
      'sango.nara.jp',
      'shimoichi.nara.jp',
      'shimokitayama.nara.jp',
      'shinjo.nara.jp',
      'soni.nara.jp',
      'takatori.nara.jp',
      'tawaramoto.nara.jp',
      'tenkawa.nara.jp',
      'tenri.nara.jp',
      'uda.nara.jp',
      'yamatokoriyama.nara.jp',
      'yamatotakada.nara.jp',
      'yamazoe.nara.jp',
      'yoshino.nara.jp',
      'aga.niigata.jp',
      'agano.niigata.jp',
      'gosen.niigata.jp',
      'itoigawa.niigata.jp',
      'izumozaki.niigata.jp',
      'joetsu.niigata.jp',
      'kamo.niigata.jp',
      'kariwa.niigata.jp',
      'kashiwazaki.niigata.jp',
      'minamiuonuma.niigata.jp',
      'mitsuke.niigata.jp',
      'muika.niigata.jp',
      'murakami.niigata.jp',
      'myoko.niigata.jp',
      'nagaoka.niigata.jp',
      'niigata.niigata.jp',
      'ojiya.niigata.jp',
      'omi.niigata.jp',
      'sado.niigata.jp',
      'sanjo.niigata.jp',
      'seiro.niigata.jp',
      'seirou.niigata.jp',
      'sekikawa.niigata.jp',
      'shibata.niigata.jp',
      'tagami.niigata.jp',
      'tainai.niigata.jp',
      'tochio.niigata.jp',
      'tokamachi.niigata.jp',
      'tsubame.niigata.jp',
      'tsunan.niigata.jp',
      'uonuma.niigata.jp',
      'yahiko.niigata.jp',
      'yoita.niigata.jp',
      'yuzawa.niigata.jp',
      'beppu.oita.jp',
      'bungoono.oita.jp',
      'bungotakada.oita.jp',
      'hasama.oita.jp',
      'hiji.oita.jp',
      'himeshima.oita.jp',
      'hita.oita.jp',
      'kamitsue.oita.jp',
      'kokonoe.oita.jp',
      'kuju.oita.jp',
      'kunisaki.oita.jp',
      'kusu.oita.jp',
      'oita.oita.jp',
      'saiki.oita.jp',
      'taketa.oita.jp',
      'tsukumi.oita.jp',
      'usa.oita.jp',
      'usuki.oita.jp',
      'yufu.oita.jp',
      'akaiwa.okayama.jp',
      'asakuchi.okayama.jp',
      'bizen.okayama.jp',
      'hayashima.okayama.jp',
      'ibara.okayama.jp',
      'kagamino.okayama.jp',
      'kasaoka.okayama.jp',
      'kibichuo.okayama.jp',
      'kumenan.okayama.jp',
      'kurashiki.okayama.jp',
      'maniwa.okayama.jp',
      'misaki.okayama.jp',
      'nagi.okayama.jp',
      'niimi.okayama.jp',
      'nishiawakura.okayama.jp',
      'okayama.okayama.jp',
      'satosho.okayama.jp',
      'setouchi.okayama.jp',
      'shinjo.okayama.jp',
      'shoo.okayama.jp',
      'soja.okayama.jp',
      'takahashi.okayama.jp',
      'tamano.okayama.jp',
      'tsuyama.okayama.jp',
      'wake.okayama.jp',
      'yakage.okayama.jp',
      'aguni.okinawa.jp',
      'ginowan.okinawa.jp',
      'ginoza.okinawa.jp',
      'gushikami.okinawa.jp',
      'haebaru.okinawa.jp',
      'higashi.okinawa.jp',
      'hirara.okinawa.jp',
      'iheya.okinawa.jp',
      'ishigaki.okinawa.jp',
      'ishikawa.okinawa.jp',
      'itoman.okinawa.jp',
      'izena.okinawa.jp',
      'kadena.okinawa.jp',
      'kin.okinawa.jp',
      'kitadaito.okinawa.jp',
      'kitanakagusuku.okinawa.jp',
      'kumejima.okinawa.jp',
      'kunigami.okinawa.jp',
      'minamidaito.okinawa.jp',
      'motobu.okinawa.jp',
      'nago.okinawa.jp',
      'naha.okinawa.jp',
      'nakagusuku.okinawa.jp',
      'nakijin.okinawa.jp',
      'nanjo.okinawa.jp',
      'nishihara.okinawa.jp',
      'ogimi.okinawa.jp',
      'okinawa.okinawa.jp',
      'onna.okinawa.jp',
      'shimoji.okinawa.jp',
      'taketomi.okinawa.jp',
      'tarama.okinawa.jp',
      'tokashiki.okinawa.jp',
      'tomigusuku.okinawa.jp',
      'tonaki.okinawa.jp',
      'urasoe.okinawa.jp',
      'uruma.okinawa.jp',
      'yaese.okinawa.jp',
      'yomitan.okinawa.jp',
      'yonabaru.okinawa.jp',
      'yonaguni.okinawa.jp',
      'zamami.okinawa.jp',
      'abeno.osaka.jp',
      'chihayaakasaka.osaka.jp',
      'chuo.osaka.jp',
      'daito.osaka.jp',
      'fujiidera.osaka.jp',
      'habikino.osaka.jp',
      'hannan.osaka.jp',
      'higashiosaka.osaka.jp',
      'higashisumiyoshi.osaka.jp',
      'higashiyodogawa.osaka.jp',
      'hirakata.osaka.jp',
      'ibaraki.osaka.jp',
      'ikeda.osaka.jp',
      'izumi.osaka.jp',
      'izumiotsu.osaka.jp',
      'izumisano.osaka.jp',
      'kadoma.osaka.jp',
      'kaizuka.osaka.jp',
      'kanan.osaka.jp',
      'kashiwara.osaka.jp',
      'katano.osaka.jp',
      'kawachinagano.osaka.jp',
      'kishiwada.osaka.jp',
      'kita.osaka.jp',
      'kumatori.osaka.jp',
      'matsubara.osaka.jp',
      'minato.osaka.jp',
      'minoh.osaka.jp',
      'misaki.osaka.jp',
      'moriguchi.osaka.jp',
      'neyagawa.osaka.jp',
      'nishi.osaka.jp',
      'nose.osaka.jp',
      'osakasayama.osaka.jp',
      'sakai.osaka.jp',
      'sayama.osaka.jp',
      'sennan.osaka.jp',
      'settsu.osaka.jp',
      'shijonawate.osaka.jp',
      'shimamoto.osaka.jp',
      'suita.osaka.jp',
      'tadaoka.osaka.jp',
      'taishi.osaka.jp',
      'tajiri.osaka.jp',
      'takaishi.osaka.jp',
      'takatsuki.osaka.jp',
      'tondabayashi.osaka.jp',
      'toyonaka.osaka.jp',
      'toyono.osaka.jp',
      'yao.osaka.jp',
      'ariake.saga.jp',
      'arita.saga.jp',
      'fukudomi.saga.jp',
      'genkai.saga.jp',
      'hamatama.saga.jp',
      'hizen.saga.jp',
      'imari.saga.jp',
      'kamimine.saga.jp',
      'kanzaki.saga.jp',
      'karatsu.saga.jp',
      'kashima.saga.jp',
      'kitagata.saga.jp',
      'kitahata.saga.jp',
      'kiyama.saga.jp',
      'kouhoku.saga.jp',
      'kyuragi.saga.jp',
      'nishiarita.saga.jp',
      'ogi.saga.jp',
      'omachi.saga.jp',
      'ouchi.saga.jp',
      'saga.saga.jp',
      'shiroishi.saga.jp',
      'taku.saga.jp',
      'tara.saga.jp',
      'tosu.saga.jp',
      'yoshinogari.saga.jp',
      'arakawa.saitama.jp',
      'asaka.saitama.jp',
      'chichibu.saitama.jp',
      'fujimi.saitama.jp',
      'fujimino.saitama.jp',
      'fukaya.saitama.jp',
      'hanno.saitama.jp',
      'hanyu.saitama.jp',
      'hasuda.saitama.jp',
      'hatogaya.saitama.jp',
      'hatoyama.saitama.jp',
      'hidaka.saitama.jp',
      'higashichichibu.saitama.jp',
      'higashimatsuyama.saitama.jp',
      'honjo.saitama.jp',
      'ina.saitama.jp',
      'iruma.saitama.jp',
      'iwatsuki.saitama.jp',
      'kamiizumi.saitama.jp',
      'kamikawa.saitama.jp',
      'kamisato.saitama.jp',
      'kasukabe.saitama.jp',
      'kawagoe.saitama.jp',
      'kawaguchi.saitama.jp',
      'kawajima.saitama.jp',
      'kazo.saitama.jp',
      'kitamoto.saitama.jp',
      'koshigaya.saitama.jp',
      'kounosu.saitama.jp',
      'kuki.saitama.jp',
      'kumagaya.saitama.jp',
      'matsubushi.saitama.jp',
      'minano.saitama.jp',
      'misato.saitama.jp',
      'miyashiro.saitama.jp',
      'miyoshi.saitama.jp',
      'moroyama.saitama.jp',
      'nagatoro.saitama.jp',
      'namegawa.saitama.jp',
      'niiza.saitama.jp',
      'ogano.saitama.jp',
      'ogawa.saitama.jp',
      'ogose.saitama.jp',
      'okegawa.saitama.jp',
      'omiya.saitama.jp',
      'otaki.saitama.jp',
      'ranzan.saitama.jp',
      'ryokami.saitama.jp',
      'saitama.saitama.jp',
      'sakado.saitama.jp',
      'satte.saitama.jp',
      'sayama.saitama.jp',
      'shiki.saitama.jp',
      'shiraoka.saitama.jp',
      'soka.saitama.jp',
      'sugito.saitama.jp',
      'toda.saitama.jp',
      'tokigawa.saitama.jp',
      'tokorozawa.saitama.jp',
      'tsurugashima.saitama.jp',
      'urawa.saitama.jp',
      'warabi.saitama.jp',
      'yashio.saitama.jp',
      'yokoze.saitama.jp',
      'yono.saitama.jp',
      'yorii.saitama.jp',
      'yoshida.saitama.jp',
      'yoshikawa.saitama.jp',
      'yoshimi.saitama.jp',
      'aisho.shiga.jp',
      'gamo.shiga.jp',
      'higashiomi.shiga.jp',
      'hikone.shiga.jp',
      'koka.shiga.jp',
      'konan.shiga.jp',
      'kosei.shiga.jp',
      'koto.shiga.jp',
      'kusatsu.shiga.jp',
      'maibara.shiga.jp',
      'moriyama.shiga.jp',
      'nagahama.shiga.jp',
      'nishiazai.shiga.jp',
      'notogawa.shiga.jp',
      'omihachiman.shiga.jp',
      'otsu.shiga.jp',
      'ritto.shiga.jp',
      'ryuoh.shiga.jp',
      'takashima.shiga.jp',
      'takatsuki.shiga.jp',
      'torahime.shiga.jp',
      'toyosato.shiga.jp',
      'yasu.shiga.jp',
      'akagi.shimane.jp',
      'ama.shimane.jp',
      'gotsu.shimane.jp',
      'hamada.shimane.jp',
      'higashiizumo.shimane.jp',
      'hikawa.shimane.jp',
      'hikimi.shimane.jp',
      'izumo.shimane.jp',
      'kakinoki.shimane.jp',
      'masuda.shimane.jp',
      'matsue.shimane.jp',
      'misato.shimane.jp',
      'nishinoshima.shimane.jp',
      'ohda.shimane.jp',
      'okinoshima.shimane.jp',
      'okuizumo.shimane.jp',
      'shimane.shimane.jp',
      'tamayu.shimane.jp',
      'tsuwano.shimane.jp',
      'unnan.shimane.jp',
      'yakumo.shimane.jp',
      'yasugi.shimane.jp',
      'yatsuka.shimane.jp',
      'arai.shizuoka.jp',
      'atami.shizuoka.jp',
      'fuji.shizuoka.jp',
      'fujieda.shizuoka.jp',
      'fujikawa.shizuoka.jp',
      'fujinomiya.shizuoka.jp',
      'fukuroi.shizuoka.jp',
      'gotemba.shizuoka.jp',
      'haibara.shizuoka.jp',
      'hamamatsu.shizuoka.jp',
      'higashiizu.shizuoka.jp',
      'ito.shizuoka.jp',
      'iwata.shizuoka.jp',
      'izu.shizuoka.jp',
      'izunokuni.shizuoka.jp',
      'kakegawa.shizuoka.jp',
      'kannami.shizuoka.jp',
      'kawanehon.shizuoka.jp',
      'kawazu.shizuoka.jp',
      'kikugawa.shizuoka.jp',
      'kosai.shizuoka.jp',
      'makinohara.shizuoka.jp',
      'matsuzaki.shizuoka.jp',
      'minamiizu.shizuoka.jp',
      'mishima.shizuoka.jp',
      'morimachi.shizuoka.jp',
      'nishiizu.shizuoka.jp',
      'numazu.shizuoka.jp',
      'omaezaki.shizuoka.jp',
      'shimada.shizuoka.jp',
      'shimizu.shizuoka.jp',
      'shimoda.shizuoka.jp',
      'shizuoka.shizuoka.jp',
      'susono.shizuoka.jp',
      'yaizu.shizuoka.jp',
      'yoshida.shizuoka.jp',
      'ashikaga.tochigi.jp',
      'bato.tochigi.jp',
      'haga.tochigi.jp',
      'ichikai.tochigi.jp',
      'iwafune.tochigi.jp',
      'kaminokawa.tochigi.jp',
      'kanuma.tochigi.jp',
      'karasuyama.tochigi.jp',
      'kuroiso.tochigi.jp',
      'mashiko.tochigi.jp',
      'mibu.tochigi.jp',
      'moka.tochigi.jp',
      'motegi.tochigi.jp',
      'nasu.tochigi.jp',
      'nasushiobara.tochigi.jp',
      'nikko.tochigi.jp',
      'nishikata.tochigi.jp',
      'nogi.tochigi.jp',
      'ohira.tochigi.jp',
      'ohtawara.tochigi.jp',
      'oyama.tochigi.jp',
      'sakura.tochigi.jp',
      'sano.tochigi.jp',
      'shimotsuke.tochigi.jp',
      'shioya.tochigi.jp',
      'takanezawa.tochigi.jp',
      'tochigi.tochigi.jp',
      'tsuga.tochigi.jp',
      'ujiie.tochigi.jp',
      'utsunomiya.tochigi.jp',
      'yaita.tochigi.jp',
      'aizumi.tokushima.jp',
      'anan.tokushima.jp',
      'ichiba.tokushima.jp',
      'itano.tokushima.jp',
      'kainan.tokushima.jp',
      'komatsushima.tokushima.jp',
      'matsushige.tokushima.jp',
      'mima.tokushima.jp',
      'minami.tokushima.jp',
      'miyoshi.tokushima.jp',
      'mugi.tokushima.jp',
      'nakagawa.tokushima.jp',
      'naruto.tokushima.jp',
      'sanagochi.tokushima.jp',
      'shishikui.tokushima.jp',
      'tokushima.tokushima.jp',
      'wajiki.tokushima.jp',
      'adachi.tokyo.jp',
      'akiruno.tokyo.jp',
      'akishima.tokyo.jp',
      'aogashima.tokyo.jp',
      'arakawa.tokyo.jp',
      'bunkyo.tokyo.jp',
      'chiyoda.tokyo.jp',
      'chofu.tokyo.jp',
      'chuo.tokyo.jp',
      'edogawa.tokyo.jp',
      'fuchu.tokyo.jp',
      'fussa.tokyo.jp',
      'hachijo.tokyo.jp',
      'hachioji.tokyo.jp',
      'hamura.tokyo.jp',
      'higashikurume.tokyo.jp',
      'higashimurayama.tokyo.jp',
      'higashiyamato.tokyo.jp',
      'hino.tokyo.jp',
      'hinode.tokyo.jp',
      'hinohara.tokyo.jp',
      'inagi.tokyo.jp',
      'itabashi.tokyo.jp',
      'katsushika.tokyo.jp',
      'kita.tokyo.jp',
      'kiyose.tokyo.jp',
      'kodaira.tokyo.jp',
      'koganei.tokyo.jp',
      'kokubunji.tokyo.jp',
      'komae.tokyo.jp',
      'koto.tokyo.jp',
      'kouzushima.tokyo.jp',
      'kunitachi.tokyo.jp',
      'machida.tokyo.jp',
      'meguro.tokyo.jp',
      'minato.tokyo.jp',
      'mitaka.tokyo.jp',
      'mizuho.tokyo.jp',
      'musashimurayama.tokyo.jp',
      'musashino.tokyo.jp',
      'nakano.tokyo.jp',
      'nerima.tokyo.jp',
      'ogasawara.tokyo.jp',
      'okutama.tokyo.jp',
      'ome.tokyo.jp',
      'oshima.tokyo.jp',
      'ota.tokyo.jp',
      'setagaya.tokyo.jp',
      'shibuya.tokyo.jp',
      'shinagawa.tokyo.jp',
      'shinjuku.tokyo.jp',
      'suginami.tokyo.jp',
      'sumida.tokyo.jp',
      'tachikawa.tokyo.jp',
      'taito.tokyo.jp',
      'tama.tokyo.jp',
      'toshima.tokyo.jp',
      'chizu.tottori.jp',
      'hino.tottori.jp',
      'kawahara.tottori.jp',
      'koge.tottori.jp',
      'kotoura.tottori.jp',
      'misasa.tottori.jp',
      'nanbu.tottori.jp',
      'nichinan.tottori.jp',
      'sakaiminato.tottori.jp',
      'tottori.tottori.jp',
      'wakasa.tottori.jp',
      'yazu.tottori.jp',
      'yonago.tottori.jp',
      'asahi.toyama.jp',
      'fuchu.toyama.jp',
      'fukumitsu.toyama.jp',
      'funahashi.toyama.jp',
      'himi.toyama.jp',
      'imizu.toyama.jp',
      'inami.toyama.jp',
      'johana.toyama.jp',
      'kamiichi.toyama.jp',
      'kurobe.toyama.jp',
      'nakaniikawa.toyama.jp',
      'namerikawa.toyama.jp',
      'nanto.toyama.jp',
      'nyuzen.toyama.jp',
      'oyabe.toyama.jp',
      'taira.toyama.jp',
      'takaoka.toyama.jp',
      'tateyama.toyama.jp',
      'toga.toyama.jp',
      'tonami.toyama.jp',
      'toyama.toyama.jp',
      'unazuki.toyama.jp',
      'uozu.toyama.jp',
      'yamada.toyama.jp',
      'arida.wakayama.jp',
      'aridagawa.wakayama.jp',
      'gobo.wakayama.jp',
      'hashimoto.wakayama.jp',
      'hidaka.wakayama.jp',
      'hirogawa.wakayama.jp',
      'inami.wakayama.jp',
      'iwade.wakayama.jp',
      'kainan.wakayama.jp',
      'kamitonda.wakayama.jp',
      'katsuragi.wakayama.jp',
      'kimino.wakayama.jp',
      'kinokawa.wakayama.jp',
      'kitayama.wakayama.jp',
      'koya.wakayama.jp',
      'koza.wakayama.jp',
      'kozagawa.wakayama.jp',
      'kudoyama.wakayama.jp',
      'kushimoto.wakayama.jp',
      'mihama.wakayama.jp',
      'misato.wakayama.jp',
      'nachikatsuura.wakayama.jp',
      'shingu.wakayama.jp',
      'shirahama.wakayama.jp',
      'taiji.wakayama.jp',
      'tanabe.wakayama.jp',
      'wakayama.wakayama.jp',
      'yuasa.wakayama.jp',
      'yura.wakayama.jp',
      'asahi.yamagata.jp',
      'funagata.yamagata.jp',
      'higashine.yamagata.jp',
      'iide.yamagata.jp',
      'kahoku.yamagata.jp',
      'kaminoyama.yamagata.jp',
      'kaneyama.yamagata.jp',
      'kawanishi.yamagata.jp',
      'mamurogawa.yamagata.jp',
      'mikawa.yamagata.jp',
      'murayama.yamagata.jp',
      'nagai.yamagata.jp',
      'nakayama.yamagata.jp',
      'nanyo.yamagata.jp',
      'nishikawa.yamagata.jp',
      'obanazawa.yamagata.jp',
      'oe.yamagata.jp',
      'oguni.yamagata.jp',
      'ohkura.yamagata.jp',
      'oishida.yamagata.jp',
      'sagae.yamagata.jp',
      'sakata.yamagata.jp',
      'sakegawa.yamagata.jp',
      'shinjo.yamagata.jp',
      'shirataka.yamagata.jp',
      'shonai.yamagata.jp',
      'takahata.yamagata.jp',
      'tendo.yamagata.jp',
      'tozawa.yamagata.jp',
      'tsuruoka.yamagata.jp',
      'yamagata.yamagata.jp',
      'yamanobe.yamagata.jp',
      'yonezawa.yamagata.jp',
      'yuza.yamagata.jp',
      'abu.yamaguchi.jp',
      'hagi.yamaguchi.jp',
      'hikari.yamaguchi.jp',
      'hofu.yamaguchi.jp',
      'iwakuni.yamaguchi.jp',
      'kudamatsu.yamaguchi.jp',
      'mitou.yamaguchi.jp',
      'nagato.yamaguchi.jp',
      'oshima.yamaguchi.jp',
      'shimonoseki.yamaguchi.jp',
      'shunan.yamaguchi.jp',
      'tabuse.yamaguchi.jp',
      'tokuyama.yamaguchi.jp',
      'toyota.yamaguchi.jp',
      'ube.yamaguchi.jp',
      'yuu.yamaguchi.jp',
      'chuo.yamanashi.jp',
      'doshi.yamanashi.jp',
      'fuefuki.yamanashi.jp',
      'fujikawa.yamanashi.jp',
      'fujikawaguchiko.yamanashi.jp',
      'fujiyoshida.yamanashi.jp',
      'hayakawa.yamanashi.jp',
      'hokuto.yamanashi.jp',
      'ichikawamisato.yamanashi.jp',
      'kai.yamanashi.jp',
      'kofu.yamanashi.jp',
      'koshu.yamanashi.jp',
      'kosuge.yamanashi.jp',
      'minami-alps.yamanashi.jp',
      'minobu.yamanashi.jp',
      'nakamichi.yamanashi.jp',
      'nanbu.yamanashi.jp',
      'narusawa.yamanashi.jp',
      'nirasaki.yamanashi.jp',
      'nishikatsura.yamanashi.jp',
      'oshino.yamanashi.jp',
      'otsuki.yamanashi.jp',
      'showa.yamanashi.jp',
      'tabayama.yamanashi.jp',
      'tsuru.yamanashi.jp',
      'uenohara.yamanashi.jp',
      'yamanakako.yamanashi.jp',
      'yamanashi.yamanashi.jp',
      'ke',
      'ac.ke',
      'co.ke',
      'go.ke',
      'info.ke',
      'me.ke',
      'mobi.ke',
      'ne.ke',
      'or.ke',
      'sc.ke',
      'kg',
      'com.kg',
      'edu.kg',
      'gov.kg',
      'mil.kg',
      'net.kg',
      'org.kg',
      '*.kh',
      'ki',
      'biz.ki',
      'com.ki',
      'edu.ki',
      'gov.ki',
      'info.ki',
      'net.ki',
      'org.ki',
      'km',
      'ass.km',
      'com.km',
      'edu.km',
      'gov.km',
      'mil.km',
      'nom.km',
      'org.km',
      'prd.km',
      'tm.km',
      'asso.km',
      'coop.km',
      'gouv.km',
      'medecin.km',
      'notaires.km',
      'pharmaciens.km',
      'presse.km',
      'veterinaire.km',
      'kn',
      'edu.kn',
      'gov.kn',
      'net.kn',
      'org.kn',
      'kp',
      'com.kp',
      'edu.kp',
      'gov.kp',
      'org.kp',
      'rep.kp',
      'tra.kp',
      'kr',
      'ac.kr',
      'co.kr',
      'es.kr',
      'go.kr',
      'hs.kr',
      'kg.kr',
      'mil.kr',
      'ms.kr',
      'ne.kr',
      'or.kr',
      'pe.kr',
      're.kr',
      'sc.kr',
      'busan.kr',
      'chungbuk.kr',
      'chungnam.kr',
      'daegu.kr',
      'daejeon.kr',
      'gangwon.kr',
      'gwangju.kr',
      'gyeongbuk.kr',
      'gyeonggi.kr',
      'gyeongnam.kr',
      'incheon.kr',
      'jeju.kr',
      'jeonbuk.kr',
      'jeonnam.kr',
      'seoul.kr',
      'ulsan.kr',
      'kw',
      'com.kw',
      'edu.kw',
      'emb.kw',
      'gov.kw',
      'ind.kw',
      'net.kw',
      'org.kw',
      'ky',
      'com.ky',
      'edu.ky',
      'net.ky',
      'org.ky',
      'kz',
      'com.kz',
      'edu.kz',
      'gov.kz',
      'mil.kz',
      'net.kz',
      'org.kz',
      'la',
      'com.la',
      'edu.la',
      'gov.la',
      'info.la',
      'int.la',
      'net.la',
      'org.la',
      'per.la',
      'lb',
      'com.lb',
      'edu.lb',
      'gov.lb',
      'net.lb',
      'org.lb',
      'lc',
      'co.lc',
      'com.lc',
      'edu.lc',
      'gov.lc',
      'net.lc',
      'org.lc',
      'li',
      'lk',
      'ac.lk',
      'assn.lk',
      'com.lk',
      'edu.lk',
      'gov.lk',
      'grp.lk',
      'hotel.lk',
      'int.lk',
      'ltd.lk',
      'net.lk',
      'ngo.lk',
      'org.lk',
      'sch.lk',
      'soc.lk',
      'web.lk',
      'lr',
      'com.lr',
      'edu.lr',
      'gov.lr',
      'net.lr',
      'org.lr',
      'ls',
      'ac.ls',
      'biz.ls',
      'co.ls',
      'edu.ls',
      'gov.ls',
      'info.ls',
      'net.ls',
      'org.ls',
      'sc.ls',
      'lt',
      'gov.lt',
      'lu',
      'lv',
      'asn.lv',
      'com.lv',
      'conf.lv',
      'edu.lv',
      'gov.lv',
      'id.lv',
      'mil.lv',
      'net.lv',
      'org.lv',
      'ly',
      'com.ly',
      'edu.ly',
      'gov.ly',
      'id.ly',
      'med.ly',
      'net.ly',
      'org.ly',
      'plc.ly',
      'sch.ly',
      'ma',
      'ac.ma',
      'co.ma',
      'gov.ma',
      'net.ma',
      'org.ma',
      'press.ma',
      'mc',
      'asso.mc',
      'tm.mc',
      'md',
      'me',
      'ac.me',
      'co.me',
      'edu.me',
      'gov.me',
      'its.me',
      'net.me',
      'org.me',
      'priv.me',
      'mg',
      'co.mg',
      'com.mg',
      'edu.mg',
      'gov.mg',
      'mil.mg',
      'nom.mg',
      'org.mg',
      'prd.mg',
      'mh',
      'mil',
      'mk',
      'com.mk',
      'edu.mk',
      'gov.mk',
      'inf.mk',
      'name.mk',
      'net.mk',
      'org.mk',
      'ml',
      'com.ml',
      'edu.ml',
      'gouv.ml',
      'gov.ml',
      'net.ml',
      'org.ml',
      'presse.ml',
      '*.mm',
      'mn',
      'edu.mn',
      'gov.mn',
      'org.mn',
      'mo',
      'com.mo',
      'edu.mo',
      'gov.mo',
      'net.mo',
      'org.mo',
      'mobi',
      'mp',
      'mq',
      'mr',
      'gov.mr',
      'ms',
      'com.ms',
      'edu.ms',
      'gov.ms',
      'net.ms',
      'org.ms',
      'mt',
      'com.mt',
      'edu.mt',
      'net.mt',
      'org.mt',
      'mu',
      'ac.mu',
      'co.mu',
      'com.mu',
      'gov.mu',
      'net.mu',
      'or.mu',
      'org.mu',
      'museum',
      'mv',
      'aero.mv',
      'biz.mv',
      'com.mv',
      'coop.mv',
      'edu.mv',
      'gov.mv',
      'info.mv',
      'int.mv',
      'mil.mv',
      'museum.mv',
      'name.mv',
      'net.mv',
      'org.mv',
      'pro.mv',
      'mw',
      'ac.mw',
      'biz.mw',
      'co.mw',
      'com.mw',
      'coop.mw',
      'edu.mw',
      'gov.mw',
      'int.mw',
      'net.mw',
      'org.mw',
      'mx',
      'com.mx',
      'edu.mx',
      'gob.mx',
      'net.mx',
      'org.mx',
      'my',
      'biz.my',
      'com.my',
      'edu.my',
      'gov.my',
      'mil.my',
      'name.my',
      'net.my',
      'org.my',
      'mz',
      'ac.mz',
      'adv.mz',
      'co.mz',
      'edu.mz',
      'gov.mz',
      'mil.mz',
      'net.mz',
      'org.mz',
      'na',
      'alt.na',
      'co.na',
      'com.na',
      'gov.na',
      'net.na',
      'org.na',
      'name',
      'nc',
      'asso.nc',
      'nom.nc',
      'ne',
      'net',
      'nf',
      'arts.nf',
      'com.nf',
      'firm.nf',
      'info.nf',
      'net.nf',
      'other.nf',
      'per.nf',
      'rec.nf',
      'store.nf',
      'web.nf',
      'ng',
      'com.ng',
      'edu.ng',
      'gov.ng',
      'i.ng',
      'mil.ng',
      'mobi.ng',
      'name.ng',
      'net.ng',
      'org.ng',
      'sch.ng',
      'ni',
      'ac.ni',
      'biz.ni',
      'co.ni',
      'com.ni',
      'edu.ni',
      'gob.ni',
      'in.ni',
      'info.ni',
      'int.ni',
      'mil.ni',
      'net.ni',
      'nom.ni',
      'org.ni',
      'web.ni',
      'nl',
      'no',
      'fhs.no',
      'folkebibl.no',
      'fylkesbibl.no',
      'idrett.no',
      'museum.no',
      'priv.no',
      'vgs.no',
      'dep.no',
      'herad.no',
      'kommune.no',
      'mil.no',
      'stat.no',
      'aa.no',
      'ah.no',
      'bu.no',
      'fm.no',
      'hl.no',
      'hm.no',
      'jan-mayen.no',
      'mr.no',
      'nl.no',
      'nt.no',
      'of.no',
      'ol.no',
      'oslo.no',
      'rl.no',
      'sf.no',
      'st.no',
      'svalbard.no',
      'tm.no',
      'tr.no',
      'va.no',
      'vf.no',
      'gs.aa.no',
      'gs.ah.no',
      'gs.bu.no',
      'gs.fm.no',
      'gs.hl.no',
      'gs.hm.no',
      'gs.jan-mayen.no',
      'gs.mr.no',
      'gs.nl.no',
      'gs.nt.no',
      'gs.of.no',
      'gs.ol.no',
      'gs.oslo.no',
      'gs.rl.no',
      'gs.sf.no',
      'gs.st.no',
      'gs.svalbard.no',
      'gs.tm.no',
      'gs.tr.no',
      'gs.va.no',
      'gs.vf.no',
      'akrehamn.no',
      '\xE5krehamn.no',
      'algard.no',
      '\xE5lg\xE5rd.no',
      'arna.no',
      'bronnoysund.no',
      'br\xF8nn\xF8ysund.no',
      'brumunddal.no',
      'bryne.no',
      'drobak.no',
      'dr\xF8bak.no',
      'egersund.no',
      'fetsund.no',
      'floro.no',
      'flor\xF8.no',
      'fredrikstad.no',
      'hokksund.no',
      'honefoss.no',
      'h\xF8nefoss.no',
      'jessheim.no',
      'jorpeland.no',
      'j\xF8rpeland.no',
      'kirkenes.no',
      'kopervik.no',
      'krokstadelva.no',
      'langevag.no',
      'langev\xE5g.no',
      'leirvik.no',
      'mjondalen.no',
      'mj\xF8ndalen.no',
      'mo-i-rana.no',
      'mosjoen.no',
      'mosj\xF8en.no',
      'nesoddtangen.no',
      'orkanger.no',
      'osoyro.no',
      'os\xF8yro.no',
      'raholt.no',
      'r\xE5holt.no',
      'sandnessjoen.no',
      'sandnessj\xF8en.no',
      'skedsmokorset.no',
      'slattum.no',
      'spjelkavik.no',
      'stathelle.no',
      'stavern.no',
      'stjordalshalsen.no',
      'stj\xF8rdalshalsen.no',
      'tananger.no',
      'tranby.no',
      'vossevangen.no',
      'aarborte.no',
      'aejrie.no',
      'afjord.no',
      '\xE5fjord.no',
      'agdenes.no',
      'nes.akershus.no',
      'aknoluokta.no',
      '\xE1k\u014Boluokta.no',
      'al.no',
      '\xE5l.no',
      'alaheadju.no',
      '\xE1laheadju.no',
      'alesund.no',
      '\xE5lesund.no',
      'alstahaug.no',
      'alta.no',
      '\xE1lt\xE1.no',
      'alvdal.no',
      'amli.no',
      '\xE5mli.no',
      'amot.no',
      '\xE5mot.no',
      'andasuolo.no',
      'andebu.no',
      'andoy.no',
      'and\xF8y.no',
      'ardal.no',
      '\xE5rdal.no',
      'aremark.no',
      'arendal.no',
      '\xE5s.no',
      'aseral.no',
      '\xE5seral.no',
      'asker.no',
      'askim.no',
      'askoy.no',
      'ask\xF8y.no',
      'askvoll.no',
      'asnes.no',
      '\xE5snes.no',
      'audnedaln.no',
      'aukra.no',
      'aure.no',
      'aurland.no',
      'aurskog-holand.no',
      'aurskog-h\xF8land.no',
      'austevoll.no',
      'austrheim.no',
      'averoy.no',
      'aver\xF8y.no',
      'badaddja.no',
      'b\xE5d\xE5ddj\xE5.no',
      'b\xE6rum.no',
      'bahcavuotna.no',
      'b\xE1hcavuotna.no',
      'bahccavuotna.no',
      'b\xE1hccavuotna.no',
      'baidar.no',
      'b\xE1id\xE1r.no',
      'bajddar.no',
      'b\xE1jddar.no',
      'balat.no',
      'b\xE1l\xE1t.no',
      'balestrand.no',
      'ballangen.no',
      'balsfjord.no',
      'bamble.no',
      'bardu.no',
      'barum.no',
      'batsfjord.no',
      'b\xE5tsfjord.no',
      'bearalvahki.no',
      'bearalv\xE1hki.no',
      'beardu.no',
      'beiarn.no',
      'berg.no',
      'bergen.no',
      'berlevag.no',
      'berlev\xE5g.no',
      'bievat.no',
      'biev\xE1t.no',
      'bindal.no',
      'birkenes.no',
      'bjarkoy.no',
      'bjark\xF8y.no',
      'bjerkreim.no',
      'bjugn.no',
      'bodo.no',
      'bod\xF8.no',
      'bokn.no',
      'bomlo.no',
      'b\xF8mlo.no',
      'bremanger.no',
      'bronnoy.no',
      'br\xF8nn\xF8y.no',
      'budejju.no',
      'nes.buskerud.no',
      'bygland.no',
      'bykle.no',
      'cahcesuolo.no',
      '\u010D\xE1hcesuolo.no',
      'davvenjarga.no',
      'davvenj\xE1rga.no',
      'davvesiida.no',
      'deatnu.no',
      'dielddanuorri.no',
      'divtasvuodna.no',
      'divttasvuotna.no',
      'donna.no',
      'd\xF8nna.no',
      'dovre.no',
      'drammen.no',
      'drangedal.no',
      'dyroy.no',
      'dyr\xF8y.no',
      'eid.no',
      'eidfjord.no',
      'eidsberg.no',
      'eidskog.no',
      'eidsvoll.no',
      'eigersund.no',
      'elverum.no',
      'enebakk.no',
      'engerdal.no',
      'etne.no',
      'etnedal.no',
      'evenassi.no',
      'even\xE1\u0161\u0161i.no',
      'evenes.no',
      'evje-og-hornnes.no',
      'farsund.no',
      'fauske.no',
      'fedje.no',
      'fet.no',
      'finnoy.no',
      'finn\xF8y.no',
      'fitjar.no',
      'fjaler.no',
      'fjell.no',
      'fla.no',
      'fl\xE5.no',
      'flakstad.no',
      'flatanger.no',
      'flekkefjord.no',
      'flesberg.no',
      'flora.no',
      'folldal.no',
      'forde.no',
      'f\xF8rde.no',
      'forsand.no',
      'fosnes.no',
      'fr\xE6na.no',
      'frana.no',
      'frei.no',
      'frogn.no',
      'froland.no',
      'frosta.no',
      'froya.no',
      'fr\xF8ya.no',
      'fuoisku.no',
      'fuossko.no',
      'fusa.no',
      'fyresdal.no',
      'gaivuotna.no',
      'g\xE1ivuotna.no',
      'galsa.no',
      'g\xE1ls\xE1.no',
      'gamvik.no',
      'gangaviika.no',
      'g\xE1\u014Bgaviika.no',
      'gaular.no',
      'gausdal.no',
      'giehtavuoatna.no',
      'gildeskal.no',
      'gildesk\xE5l.no',
      'giske.no',
      'gjemnes.no',
      'gjerdrum.no',
      'gjerstad.no',
      'gjesdal.no',
      'gjovik.no',
      'gj\xF8vik.no',
      'gloppen.no',
      'gol.no',
      'gran.no',
      'grane.no',
      'granvin.no',
      'gratangen.no',
      'grimstad.no',
      'grong.no',
      'grue.no',
      'gulen.no',
      'guovdageaidnu.no',
      'ha.no',
      'h\xE5.no',
      'habmer.no',
      'h\xE1bmer.no',
      'hadsel.no',
      'h\xE6gebostad.no',
      'hagebostad.no',
      'halden.no',
      'halsa.no',
      'hamar.no',
      'hamaroy.no',
      'hammarfeasta.no',
      'h\xE1mm\xE1rfeasta.no',
      'hammerfest.no',
      'hapmir.no',
      'h\xE1pmir.no',
      'haram.no',
      'hareid.no',
      'harstad.no',
      'hasvik.no',
      'hattfjelldal.no',
      'haugesund.no',
      'os.hedmark.no',
      'valer.hedmark.no',
      'v\xE5ler.hedmark.no',
      'hemne.no',
      'hemnes.no',
      'hemsedal.no',
      'hitra.no',
      'hjartdal.no',
      'hjelmeland.no',
      'hobol.no',
      'hob\xF8l.no',
      'hof.no',
      'hol.no',
      'hole.no',
      'holmestrand.no',
      'holtalen.no',
      'holt\xE5len.no',
      'os.hordaland.no',
      'hornindal.no',
      'horten.no',
      'hoyanger.no',
      'h\xF8yanger.no',
      'hoylandet.no',
      'h\xF8ylandet.no',
      'hurdal.no',
      'hurum.no',
      'hvaler.no',
      'hyllestad.no',
      'ibestad.no',
      'inderoy.no',
      'inder\xF8y.no',
      'iveland.no',
      'ivgu.no',
      'jevnaker.no',
      'jolster.no',
      'j\xF8lster.no',
      'jondal.no',
      'kafjord.no',
      'k\xE5fjord.no',
      'karasjohka.no',
      'k\xE1r\xE1\u0161johka.no',
      'karasjok.no',
      'karlsoy.no',
      'karmoy.no',
      'karm\xF8y.no',
      'kautokeino.no',
      'klabu.no',
      'kl\xE6bu.no',
      'klepp.no',
      'kongsberg.no',
      'kongsvinger.no',
      'kraanghke.no',
      'kr\xE5anghke.no',
      'kragero.no',
      'krager\xF8.no',
      'kristiansand.no',
      'kristiansund.no',
      'krodsherad.no',
      'kr\xF8dsherad.no',
      'kv\xE6fjord.no',
      'kv\xE6nangen.no',
      'kvafjord.no',
      'kvalsund.no',
      'kvam.no',
      'kvanangen.no',
      'kvinesdal.no',
      'kvinnherad.no',
      'kviteseid.no',
      'kvitsoy.no',
      'kvits\xF8y.no',
      'laakesvuemie.no',
      'l\xE6rdal.no',
      'lahppi.no',
      'l\xE1hppi.no',
      'lardal.no',
      'larvik.no',
      'lavagis.no',
      'lavangen.no',
      'leangaviika.no',
      'lea\u014Bgaviika.no',
      'lebesby.no',
      'leikanger.no',
      'leirfjord.no',
      'leka.no',
      'leksvik.no',
      'lenvik.no',
      'lerdal.no',
      'lesja.no',
      'levanger.no',
      'lier.no',
      'lierne.no',
      'lillehammer.no',
      'lillesand.no',
      'lindas.no',
      'lind\xE5s.no',
      'lindesnes.no',
      'loabat.no',
      'loab\xE1t.no',
      'lodingen.no',
      'l\xF8dingen.no',
      'lom.no',
      'loppa.no',
      'lorenskog.no',
      'l\xF8renskog.no',
      'loten.no',
      'l\xF8ten.no',
      'lund.no',
      'lunner.no',
      'luroy.no',
      'lur\xF8y.no',
      'luster.no',
      'lyngdal.no',
      'lyngen.no',
      'malatvuopmi.no',
      'm\xE1latvuopmi.no',
      'malselv.no',
      'm\xE5lselv.no',
      'malvik.no',
      'mandal.no',
      'marker.no',
      'marnardal.no',
      'masfjorden.no',
      'masoy.no',
      'm\xE5s\xF8y.no',
      'matta-varjjat.no',
      'm\xE1tta-v\xE1rjjat.no',
      'meland.no',
      'meldal.no',
      'melhus.no',
      'meloy.no',
      'mel\xF8y.no',
      'meraker.no',
      'mer\xE5ker.no',
      'midsund.no',
      'midtre-gauldal.no',
      'moareke.no',
      'mo\xE5reke.no',
      'modalen.no',
      'modum.no',
      'molde.no',
      'heroy.more-og-romsdal.no',
      'sande.more-og-romsdal.no',
      'her\xF8y.m\xF8re-og-romsdal.no',
      'sande.m\xF8re-og-romsdal.no',
      'moskenes.no',
      'moss.no',
      'mosvik.no',
      'muosat.no',
      'muos\xE1t.no',
      'naamesjevuemie.no',
      'n\xE5\xE5mesjevuemie.no',
      'n\xE6r\xF8y.no',
      'namdalseid.no',
      'namsos.no',
      'namsskogan.no',
      'nannestad.no',
      'naroy.no',
      'narviika.no',
      'narvik.no',
      'naustdal.no',
      'navuotna.no',
      'n\xE1vuotna.no',
      'nedre-eiker.no',
      'nesna.no',
      'nesodden.no',
      'nesseby.no',
      'nesset.no',
      'nissedal.no',
      'nittedal.no',
      'nord-aurdal.no',
      'nord-fron.no',
      'nord-odal.no',
      'norddal.no',
      'nordkapp.no',
      'bo.nordland.no',
      'b\xF8.nordland.no',
      'heroy.nordland.no',
      'her\xF8y.nordland.no',
      'nordre-land.no',
      'nordreisa.no',
      'nore-og-uvdal.no',
      'notodden.no',
      'notteroy.no',
      'n\xF8tter\xF8y.no',
      'odda.no',
      'oksnes.no',
      '\xF8ksnes.no',
      'omasvuotna.no',
      'oppdal.no',
      'oppegard.no',
      'oppeg\xE5rd.no',
      'orkdal.no',
      'orland.no',
      '\xF8rland.no',
      'orskog.no',
      '\xF8rskog.no',
      'orsta.no',
      '\xF8rsta.no',
      'osen.no',
      'osteroy.no',
      'oster\xF8y.no',
      'valer.ostfold.no',
      'v\xE5ler.\xF8stfold.no',
      'ostre-toten.no',
      '\xF8stre-toten.no',
      'overhalla.no',
      'ovre-eiker.no',
      '\xF8vre-eiker.no',
      'oyer.no',
      '\xF8yer.no',
      'oygarden.no',
      '\xF8ygarden.no',
      'oystre-slidre.no',
      '\xF8ystre-slidre.no',
      'porsanger.no',
      'porsangu.no',
      'pors\xE1\u014Bgu.no',
      'porsgrunn.no',
      'rade.no',
      'r\xE5de.no',
      'radoy.no',
      'rad\xF8y.no',
      'r\xE6lingen.no',
      'rahkkeravju.no',
      'r\xE1hkker\xE1vju.no',
      'raisa.no',
      'r\xE1isa.no',
      'rakkestad.no',
      'ralingen.no',
      'rana.no',
      'randaberg.no',
      'rauma.no',
      'rendalen.no',
      'rennebu.no',
      'rennesoy.no',
      'rennes\xF8y.no',
      'rindal.no',
      'ringebu.no',
      'ringerike.no',
      'ringsaker.no',
      'risor.no',
      'ris\xF8r.no',
      'rissa.no',
      'roan.no',
      'rodoy.no',
      'r\xF8d\xF8y.no',
      'rollag.no',
      'romsa.no',
      'romskog.no',
      'r\xF8mskog.no',
      'roros.no',
      'r\xF8ros.no',
      'rost.no',
      'r\xF8st.no',
      'royken.no',
      'r\xF8yken.no',
      'royrvik.no',
      'r\xF8yrvik.no',
      'ruovat.no',
      'rygge.no',
      'salangen.no',
      'salat.no',
      's\xE1lat.no',
      's\xE1l\xE1t.no',
      'saltdal.no',
      'samnanger.no',
      'sandefjord.no',
      'sandnes.no',
      'sandoy.no',
      'sand\xF8y.no',
      'sarpsborg.no',
      'sauda.no',
      'sauherad.no',
      'sel.no',
      'selbu.no',
      'selje.no',
      'seljord.no',
      'siellak.no',
      'sigdal.no',
      'siljan.no',
      'sirdal.no',
      'skanit.no',
      'sk\xE1nit.no',
      'skanland.no',
      'sk\xE5nland.no',
      'skaun.no',
      'skedsmo.no',
      'ski.no',
      'skien.no',
      'skierva.no',
      'skierv\xE1.no',
      'skiptvet.no',
      'skjak.no',
      'skj\xE5k.no',
      'skjervoy.no',
      'skjerv\xF8y.no',
      'skodje.no',
      'smola.no',
      'sm\xF8la.no',
      'snaase.no',
      'sn\xE5ase.no',
      'snasa.no',
      'sn\xE5sa.no',
      'snillfjord.no',
      'snoasa.no',
      'sogndal.no',
      'sogne.no',
      's\xF8gne.no',
      'sokndal.no',
      'sola.no',
      'solund.no',
      'somna.no',
      's\xF8mna.no',
      'sondre-land.no',
      's\xF8ndre-land.no',
      'songdalen.no',
      'sor-aurdal.no',
      's\xF8r-aurdal.no',
      'sor-fron.no',
      's\xF8r-fron.no',
      'sor-odal.no',
      's\xF8r-odal.no',
      'sor-varanger.no',
      's\xF8r-varanger.no',
      'sorfold.no',
      's\xF8rfold.no',
      'sorreisa.no',
      's\xF8rreisa.no',
      'sortland.no',
      'sorum.no',
      's\xF8rum.no',
      'spydeberg.no',
      'stange.no',
      'stavanger.no',
      'steigen.no',
      'steinkjer.no',
      'stjordal.no',
      'stj\xF8rdal.no',
      'stokke.no',
      'stor-elvdal.no',
      'stord.no',
      'stordal.no',
      'storfjord.no',
      'strand.no',
      'stranda.no',
      'stryn.no',
      'sula.no',
      'suldal.no',
      'sund.no',
      'sunndal.no',
      'surnadal.no',
      'sveio.no',
      'svelvik.no',
      'sykkylven.no',
      'tana.no',
      'bo.telemark.no',
      'b\xF8.telemark.no',
      'time.no',
      'tingvoll.no',
      'tinn.no',
      'tjeldsund.no',
      'tjome.no',
      'tj\xF8me.no',
      'tokke.no',
      'tolga.no',
      'tonsberg.no',
      't\xF8nsberg.no',
      'torsken.no',
      'tr\xE6na.no',
      'trana.no',
      'tranoy.no',
      'tran\xF8y.no',
      'troandin.no',
      'trogstad.no',
      'tr\xF8gstad.no',
      'tromsa.no',
      'tromso.no',
      'troms\xF8.no',
      'trondheim.no',
      'trysil.no',
      'tvedestrand.no',
      'tydal.no',
      'tynset.no',
      'tysfjord.no',
      'tysnes.no',
      'tysv\xE6r.no',
      'tysvar.no',
      'ullensaker.no',
      'ullensvang.no',
      'ulvik.no',
      'unjarga.no',
      'unj\xE1rga.no',
      'utsira.no',
      'vaapste.no',
      'vadso.no',
      'vads\xF8.no',
      'v\xE6r\xF8y.no',
      'vaga.no',
      'v\xE5g\xE5.no',
      'vagan.no',
      'v\xE5gan.no',
      'vagsoy.no',
      'v\xE5gs\xF8y.no',
      'vaksdal.no',
      'valle.no',
      'vang.no',
      'vanylven.no',
      'vardo.no',
      'vard\xF8.no',
      'varggat.no',
      'v\xE1rgg\xE1t.no',
      'varoy.no',
      'vefsn.no',
      'vega.no',
      'vegarshei.no',
      'veg\xE5rshei.no',
      'vennesla.no',
      'verdal.no',
      'verran.no',
      'vestby.no',
      'sande.vestfold.no',
      'vestnes.no',
      'vestre-slidre.no',
      'vestre-toten.no',
      'vestvagoy.no',
      'vestv\xE5g\xF8y.no',
      'vevelstad.no',
      'vik.no',
      'vikna.no',
      'vindafjord.no',
      'voagat.no',
      'volda.no',
      'voss.no',
      '*.np',
      'nr',
      'biz.nr',
      'com.nr',
      'edu.nr',
      'gov.nr',
      'info.nr',
      'net.nr',
      'org.nr',
      'nu',
      'nz',
      'ac.nz',
      'co.nz',
      'cri.nz',
      'geek.nz',
      'gen.nz',
      'govt.nz',
      'health.nz',
      'iwi.nz',
      'kiwi.nz',
      'maori.nz',
      'm\u0101ori.nz',
      'mil.nz',
      'net.nz',
      'org.nz',
      'parliament.nz',
      'school.nz',
      'om',
      'co.om',
      'com.om',
      'edu.om',
      'gov.om',
      'med.om',
      'museum.om',
      'net.om',
      'org.om',
      'pro.om',
      'onion',
      'org',
      'pa',
      'abo.pa',
      'ac.pa',
      'com.pa',
      'edu.pa',
      'gob.pa',
      'ing.pa',
      'med.pa',
      'net.pa',
      'nom.pa',
      'org.pa',
      'sld.pa',
      'pe',
      'com.pe',
      'edu.pe',
      'gob.pe',
      'mil.pe',
      'net.pe',
      'nom.pe',
      'org.pe',
      'pf',
      'com.pf',
      'edu.pf',
      'org.pf',
      '*.pg',
      'ph',
      'com.ph',
      'edu.ph',
      'gov.ph',
      'i.ph',
      'mil.ph',
      'net.ph',
      'ngo.ph',
      'org.ph',
      'pk',
      'ac.pk',
      'biz.pk',
      'com.pk',
      'edu.pk',
      'fam.pk',
      'gkp.pk',
      'gob.pk',
      'gog.pk',
      'gok.pk',
      'gon.pk',
      'gop.pk',
      'gos.pk',
      'gov.pk',
      'net.pk',
      'org.pk',
      'web.pk',
      'pl',
      'com.pl',
      'net.pl',
      'org.pl',
      'agro.pl',
      'aid.pl',
      'atm.pl',
      'auto.pl',
      'biz.pl',
      'edu.pl',
      'gmina.pl',
      'gsm.pl',
      'info.pl',
      'mail.pl',
      'media.pl',
      'miasta.pl',
      'mil.pl',
      'nieruchomosci.pl',
      'nom.pl',
      'pc.pl',
      'powiat.pl',
      'priv.pl',
      'realestate.pl',
      'rel.pl',
      'sex.pl',
      'shop.pl',
      'sklep.pl',
      'sos.pl',
      'szkola.pl',
      'targi.pl',
      'tm.pl',
      'tourism.pl',
      'travel.pl',
      'turystyka.pl',
      'gov.pl',
      'ap.gov.pl',
      'griw.gov.pl',
      'ic.gov.pl',
      'is.gov.pl',
      'kmpsp.gov.pl',
      'konsulat.gov.pl',
      'kppsp.gov.pl',
      'kwp.gov.pl',
      'kwpsp.gov.pl',
      'mup.gov.pl',
      'mw.gov.pl',
      'oia.gov.pl',
      'oirm.gov.pl',
      'oke.gov.pl',
      'oow.gov.pl',
      'oschr.gov.pl',
      'oum.gov.pl',
      'pa.gov.pl',
      'pinb.gov.pl',
      'piw.gov.pl',
      'po.gov.pl',
      'pr.gov.pl',
      'psp.gov.pl',
      'psse.gov.pl',
      'pup.gov.pl',
      'rzgw.gov.pl',
      'sa.gov.pl',
      'sdn.gov.pl',
      'sko.gov.pl',
      'so.gov.pl',
      'sr.gov.pl',
      'starostwo.gov.pl',
      'ug.gov.pl',
      'ugim.gov.pl',
      'um.gov.pl',
      'umig.gov.pl',
      'upow.gov.pl',
      'uppo.gov.pl',
      'us.gov.pl',
      'uw.gov.pl',
      'uzs.gov.pl',
      'wif.gov.pl',
      'wiih.gov.pl',
      'winb.gov.pl',
      'wios.gov.pl',
      'witd.gov.pl',
      'wiw.gov.pl',
      'wkz.gov.pl',
      'wsa.gov.pl',
      'wskr.gov.pl',
      'wsse.gov.pl',
      'wuoz.gov.pl',
      'wzmiuw.gov.pl',
      'zp.gov.pl',
      'zpisdn.gov.pl',
      'augustow.pl',
      'babia-gora.pl',
      'bedzin.pl',
      'beskidy.pl',
      'bialowieza.pl',
      'bialystok.pl',
      'bielawa.pl',
      'bieszczady.pl',
      'boleslawiec.pl',
      'bydgoszcz.pl',
      'bytom.pl',
      'cieszyn.pl',
      'czeladz.pl',
      'czest.pl',
      'dlugoleka.pl',
      'elblag.pl',
      'elk.pl',
      'glogow.pl',
      'gniezno.pl',
      'gorlice.pl',
      'grajewo.pl',
      'ilawa.pl',
      'jaworzno.pl',
      'jelenia-gora.pl',
      'jgora.pl',
      'kalisz.pl',
      'karpacz.pl',
      'kartuzy.pl',
      'kaszuby.pl',
      'katowice.pl',
      'kazimierz-dolny.pl',
      'kepno.pl',
      'ketrzyn.pl',
      'klodzko.pl',
      'kobierzyce.pl',
      'kolobrzeg.pl',
      'konin.pl',
      'konskowola.pl',
      'kutno.pl',
      'lapy.pl',
      'lebork.pl',
      'legnica.pl',
      'lezajsk.pl',
      'limanowa.pl',
      'lomza.pl',
      'lowicz.pl',
      'lubin.pl',
      'lukow.pl',
      'malbork.pl',
      'malopolska.pl',
      'mazowsze.pl',
      'mazury.pl',
      'mielec.pl',
      'mielno.pl',
      'mragowo.pl',
      'naklo.pl',
      'nowaruda.pl',
      'nysa.pl',
      'olawa.pl',
      'olecko.pl',
      'olkusz.pl',
      'olsztyn.pl',
      'opoczno.pl',
      'opole.pl',
      'ostroda.pl',
      'ostroleka.pl',
      'ostrowiec.pl',
      'ostrowwlkp.pl',
      'pila.pl',
      'pisz.pl',
      'podhale.pl',
      'podlasie.pl',
      'polkowice.pl',
      'pomorskie.pl',
      'pomorze.pl',
      'prochowice.pl',
      'pruszkow.pl',
      'przeworsk.pl',
      'pulawy.pl',
      'radom.pl',
      'rawa-maz.pl',
      'rybnik.pl',
      'rzeszow.pl',
      'sanok.pl',
      'sejny.pl',
      'skoczow.pl',
      'slask.pl',
      'slupsk.pl',
      'sosnowiec.pl',
      'stalowa-wola.pl',
      'starachowice.pl',
      'stargard.pl',
      'suwalki.pl',
      'swidnica.pl',
      'swiebodzin.pl',
      'swinoujscie.pl',
      'szczecin.pl',
      'szczytno.pl',
      'tarnobrzeg.pl',
      'tgory.pl',
      'turek.pl',
      'tychy.pl',
      'ustka.pl',
      'walbrzych.pl',
      'warmia.pl',
      'warszawa.pl',
      'waw.pl',
      'wegrow.pl',
      'wielun.pl',
      'wlocl.pl',
      'wloclawek.pl',
      'wodzislaw.pl',
      'wolomin.pl',
      'wroclaw.pl',
      'zachpomor.pl',
      'zagan.pl',
      'zarow.pl',
      'zgora.pl',
      'zgorzelec.pl',
      'pm',
      'pn',
      'co.pn',
      'edu.pn',
      'gov.pn',
      'net.pn',
      'org.pn',
      'post',
      'pr',
      'biz.pr',
      'com.pr',
      'edu.pr',
      'gov.pr',
      'info.pr',
      'isla.pr',
      'name.pr',
      'net.pr',
      'org.pr',
      'pro.pr',
      'ac.pr',
      'est.pr',
      'prof.pr',
      'pro',
      'aaa.pro',
      'aca.pro',
      'acct.pro',
      'avocat.pro',
      'bar.pro',
      'cpa.pro',
      'eng.pro',
      'jur.pro',
      'law.pro',
      'med.pro',
      'recht.pro',
      'ps',
      'com.ps',
      'edu.ps',
      'gov.ps',
      'net.ps',
      'org.ps',
      'plo.ps',
      'sec.ps',
      'pt',
      'com.pt',
      'edu.pt',
      'gov.pt',
      'int.pt',
      'net.pt',
      'nome.pt',
      'org.pt',
      'publ.pt',
      'pw',
      'belau.pw',
      'co.pw',
      'ed.pw',
      'go.pw',
      'or.pw',
      'py',
      'com.py',
      'coop.py',
      'edu.py',
      'gov.py',
      'mil.py',
      'net.py',
      'org.py',
      'qa',
      'com.qa',
      'edu.qa',
      'gov.qa',
      'mil.qa',
      'name.qa',
      'net.qa',
      'org.qa',
      'sch.qa',
      're',
      'asso.re',
      'com.re',
      'ro',
      'arts.ro',
      'com.ro',
      'firm.ro',
      'info.ro',
      'nom.ro',
      'nt.ro',
      'org.ro',
      'rec.ro',
      'store.ro',
      'tm.ro',
      'www.ro',
      'rs',
      'ac.rs',
      'co.rs',
      'edu.rs',
      'gov.rs',
      'in.rs',
      'org.rs',
      'ru',
      'rw',
      'ac.rw',
      'co.rw',
      'coop.rw',
      'gov.rw',
      'mil.rw',
      'net.rw',
      'org.rw',
      'sa',
      'com.sa',
      'edu.sa',
      'gov.sa',
      'med.sa',
      'net.sa',
      'org.sa',
      'pub.sa',
      'sch.sa',
      'sb',
      'com.sb',
      'edu.sb',
      'gov.sb',
      'net.sb',
      'org.sb',
      'sc',
      'com.sc',
      'edu.sc',
      'gov.sc',
      'net.sc',
      'org.sc',
      'sd',
      'com.sd',
      'edu.sd',
      'gov.sd',
      'info.sd',
      'med.sd',
      'net.sd',
      'org.sd',
      'tv.sd',
      'se',
      'a.se',
      'ac.se',
      'b.se',
      'bd.se',
      'brand.se',
      'c.se',
      'd.se',
      'e.se',
      'f.se',
      'fh.se',
      'fhsk.se',
      'fhv.se',
      'g.se',
      'h.se',
      'i.se',
      'k.se',
      'komforb.se',
      'kommunalforbund.se',
      'komvux.se',
      'l.se',
      'lanbib.se',
      'm.se',
      'n.se',
      'naturbruksgymn.se',
      'o.se',
      'org.se',
      'p.se',
      'parti.se',
      'pp.se',
      'press.se',
      'r.se',
      's.se',
      't.se',
      'tm.se',
      'u.se',
      'w.se',
      'x.se',
      'y.se',
      'z.se',
      'sg',
      'com.sg',
      'edu.sg',
      'gov.sg',
      'net.sg',
      'org.sg',
      'sh',
      'com.sh',
      'gov.sh',
      'mil.sh',
      'net.sh',
      'org.sh',
      'si',
      'sj',
      'sk',
      'sl',
      'com.sl',
      'edu.sl',
      'gov.sl',
      'net.sl',
      'org.sl',
      'sm',
      'sn',
      'art.sn',
      'com.sn',
      'edu.sn',
      'gouv.sn',
      'org.sn',
      'perso.sn',
      'univ.sn',
      'so',
      'com.so',
      'edu.so',
      'gov.so',
      'me.so',
      'net.so',
      'org.so',
      'sr',
      'ss',
      'biz.ss',
      'co.ss',
      'com.ss',
      'edu.ss',
      'gov.ss',
      'me.ss',
      'net.ss',
      'org.ss',
      'sch.ss',
      'st',
      'co.st',
      'com.st',
      'consulado.st',
      'edu.st',
      'embaixada.st',
      'mil.st',
      'net.st',
      'org.st',
      'principe.st',
      'saotome.st',
      'store.st',
      'su',
      'sv',
      'com.sv',
      'edu.sv',
      'gob.sv',
      'org.sv',
      'red.sv',
      'sx',
      'gov.sx',
      'sy',
      'com.sy',
      'edu.sy',
      'gov.sy',
      'mil.sy',
      'net.sy',
      'org.sy',
      'sz',
      'ac.sz',
      'co.sz',
      'org.sz',
      'tc',
      'td',
      'tel',
      'tf',
      'tg',
      'th',
      'ac.th',
      'co.th',
      'go.th',
      'in.th',
      'mi.th',
      'net.th',
      'or.th',
      'tj',
      'ac.tj',
      'biz.tj',
      'co.tj',
      'com.tj',
      'edu.tj',
      'go.tj',
      'gov.tj',
      'int.tj',
      'mil.tj',
      'name.tj',
      'net.tj',
      'nic.tj',
      'org.tj',
      'test.tj',
      'web.tj',
      'tk',
      'tl',
      'gov.tl',
      'tm',
      'co.tm',
      'com.tm',
      'edu.tm',
      'gov.tm',
      'mil.tm',
      'net.tm',
      'nom.tm',
      'org.tm',
      'tn',
      'com.tn',
      'ens.tn',
      'fin.tn',
      'gov.tn',
      'ind.tn',
      'info.tn',
      'intl.tn',
      'mincom.tn',
      'nat.tn',
      'net.tn',
      'org.tn',
      'perso.tn',
      'tourism.tn',
      'to',
      'com.to',
      'edu.to',
      'gov.to',
      'mil.to',
      'net.to',
      'org.to',
      'tr',
      'av.tr',
      'bbs.tr',
      'bel.tr',
      'biz.tr',
      'com.tr',
      'dr.tr',
      'edu.tr',
      'gen.tr',
      'gov.tr',
      'info.tr',
      'k12.tr',
      'kep.tr',
      'mil.tr',
      'name.tr',
      'net.tr',
      'org.tr',
      'pol.tr',
      'tel.tr',
      'tsk.tr',
      'tv.tr',
      'web.tr',
      'nc.tr',
      'gov.nc.tr',
      'tt',
      'biz.tt',
      'co.tt',
      'com.tt',
      'edu.tt',
      'gov.tt',
      'info.tt',
      'mil.tt',
      'name.tt',
      'net.tt',
      'org.tt',
      'pro.tt',
      'tv',
      'tw',
      'club.tw',
      'com.tw',
      'ebiz.tw',
      'edu.tw',
      'game.tw',
      'gov.tw',
      'idv.tw',
      'mil.tw',
      'net.tw',
      'org.tw',
      'tz',
      'ac.tz',
      'co.tz',
      'go.tz',
      'hotel.tz',
      'info.tz',
      'me.tz',
      'mil.tz',
      'mobi.tz',
      'ne.tz',
      'or.tz',
      'sc.tz',
      'tv.tz',
      'ua',
      'com.ua',
      'edu.ua',
      'gov.ua',
      'in.ua',
      'net.ua',
      'org.ua',
      'cherkassy.ua',
      'cherkasy.ua',
      'chernigov.ua',
      'chernihiv.ua',
      'chernivtsi.ua',
      'chernovtsy.ua',
      'ck.ua',
      'cn.ua',
      'cr.ua',
      'crimea.ua',
      'cv.ua',
      'dn.ua',
      'dnepropetrovsk.ua',
      'dnipropetrovsk.ua',
      'donetsk.ua',
      'dp.ua',
      'if.ua',
      'ivano-frankivsk.ua',
      'kh.ua',
      'kharkiv.ua',
      'kharkov.ua',
      'kherson.ua',
      'khmelnitskiy.ua',
      'khmelnytskyi.ua',
      'kiev.ua',
      'kirovograd.ua',
      'km.ua',
      'kr.ua',
      'kropyvnytskyi.ua',
      'krym.ua',
      'ks.ua',
      'kv.ua',
      'kyiv.ua',
      'lg.ua',
      'lt.ua',
      'lugansk.ua',
      'luhansk.ua',
      'lutsk.ua',
      'lv.ua',
      'lviv.ua',
      'mk.ua',
      'mykolaiv.ua',
      'nikolaev.ua',
      'od.ua',
      'odesa.ua',
      'odessa.ua',
      'pl.ua',
      'poltava.ua',
      'rivne.ua',
      'rovno.ua',
      'rv.ua',
      'sb.ua',
      'sebastopol.ua',
      'sevastopol.ua',
      'sm.ua',
      'sumy.ua',
      'te.ua',
      'ternopil.ua',
      'uz.ua',
      'uzhgorod.ua',
      'uzhhorod.ua',
      'vinnica.ua',
      'vinnytsia.ua',
      'vn.ua',
      'volyn.ua',
      'yalta.ua',
      'zakarpattia.ua',
      'zaporizhzhe.ua',
      'zaporizhzhia.ua',
      'zhitomir.ua',
      'zhytomyr.ua',
      'zp.ua',
      'zt.ua',
      'ug',
      'ac.ug',
      'co.ug',
      'com.ug',
      'go.ug',
      'ne.ug',
      'or.ug',
      'org.ug',
      'sc.ug',
      'uk',
      'ac.uk',
      'co.uk',
      'gov.uk',
      'ltd.uk',
      'me.uk',
      'net.uk',
      'nhs.uk',
      'org.uk',
      'plc.uk',
      'police.uk',
      '*.sch.uk',
      'us',
      'dni.us',
      'fed.us',
      'isa.us',
      'kids.us',
      'nsn.us',
      'ak.us',
      'al.us',
      'ar.us',
      'as.us',
      'az.us',
      'ca.us',
      'co.us',
      'ct.us',
      'dc.us',
      'de.us',
      'fl.us',
      'ga.us',
      'gu.us',
      'hi.us',
      'ia.us',
      'id.us',
      'il.us',
      'in.us',
      'ks.us',
      'ky.us',
      'la.us',
      'ma.us',
      'md.us',
      'me.us',
      'mi.us',
      'mn.us',
      'mo.us',
      'ms.us',
      'mt.us',
      'nc.us',
      'nd.us',
      'ne.us',
      'nh.us',
      'nj.us',
      'nm.us',
      'nv.us',
      'ny.us',
      'oh.us',
      'ok.us',
      'or.us',
      'pa.us',
      'pr.us',
      'ri.us',
      'sc.us',
      'sd.us',
      'tn.us',
      'tx.us',
      'ut.us',
      'va.us',
      'vi.us',
      'vt.us',
      'wa.us',
      'wi.us',
      'wv.us',
      'wy.us',
      'k12.ak.us',
      'k12.al.us',
      'k12.ar.us',
      'k12.as.us',
      'k12.az.us',
      'k12.ca.us',
      'k12.co.us',
      'k12.ct.us',
      'k12.dc.us',
      'k12.fl.us',
      'k12.ga.us',
      'k12.gu.us',
      'k12.ia.us',
      'k12.id.us',
      'k12.il.us',
      'k12.in.us',
      'k12.ks.us',
      'k12.ky.us',
      'k12.la.us',
      'k12.ma.us',
      'k12.md.us',
      'k12.me.us',
      'k12.mi.us',
      'k12.mn.us',
      'k12.mo.us',
      'k12.ms.us',
      'k12.mt.us',
      'k12.nc.us',
      'k12.ne.us',
      'k12.nh.us',
      'k12.nj.us',
      'k12.nm.us',
      'k12.nv.us',
      'k12.ny.us',
      'k12.oh.us',
      'k12.ok.us',
      'k12.or.us',
      'k12.pa.us',
      'k12.pr.us',
      'k12.sc.us',
      'k12.tn.us',
      'k12.tx.us',
      'k12.ut.us',
      'k12.va.us',
      'k12.vi.us',
      'k12.vt.us',
      'k12.wa.us',
      'k12.wi.us',
      'cc.ak.us',
      'lib.ak.us',
      'cc.al.us',
      'lib.al.us',
      'cc.ar.us',
      'lib.ar.us',
      'cc.as.us',
      'lib.as.us',
      'cc.az.us',
      'lib.az.us',
      'cc.ca.us',
      'lib.ca.us',
      'cc.co.us',
      'lib.co.us',
      'cc.ct.us',
      'lib.ct.us',
      'cc.dc.us',
      'lib.dc.us',
      'cc.de.us',
      'cc.fl.us',
      'cc.ga.us',
      'cc.gu.us',
      'cc.hi.us',
      'cc.ia.us',
      'cc.id.us',
      'cc.il.us',
      'cc.in.us',
      'cc.ks.us',
      'cc.ky.us',
      'cc.la.us',
      'cc.ma.us',
      'cc.md.us',
      'cc.me.us',
      'cc.mi.us',
      'cc.mn.us',
      'cc.mo.us',
      'cc.ms.us',
      'cc.mt.us',
      'cc.nc.us',
      'cc.nd.us',
      'cc.ne.us',
      'cc.nh.us',
      'cc.nj.us',
      'cc.nm.us',
      'cc.nv.us',
      'cc.ny.us',
      'cc.oh.us',
      'cc.ok.us',
      'cc.or.us',
      'cc.pa.us',
      'cc.pr.us',
      'cc.ri.us',
      'cc.sc.us',
      'cc.sd.us',
      'cc.tn.us',
      'cc.tx.us',
      'cc.ut.us',
      'cc.va.us',
      'cc.vi.us',
      'cc.vt.us',
      'cc.wa.us',
      'cc.wi.us',
      'cc.wv.us',
      'cc.wy.us',
      'k12.wy.us',
      'lib.fl.us',
      'lib.ga.us',
      'lib.gu.us',
      'lib.hi.us',
      'lib.ia.us',
      'lib.id.us',
      'lib.il.us',
      'lib.in.us',
      'lib.ks.us',
      'lib.ky.us',
      'lib.la.us',
      'lib.ma.us',
      'lib.md.us',
      'lib.me.us',
      'lib.mi.us',
      'lib.mn.us',
      'lib.mo.us',
      'lib.ms.us',
      'lib.mt.us',
      'lib.nc.us',
      'lib.nd.us',
      'lib.ne.us',
      'lib.nh.us',
      'lib.nj.us',
      'lib.nm.us',
      'lib.nv.us',
      'lib.ny.us',
      'lib.oh.us',
      'lib.ok.us',
      'lib.or.us',
      'lib.pa.us',
      'lib.pr.us',
      'lib.ri.us',
      'lib.sc.us',
      'lib.sd.us',
      'lib.tn.us',
      'lib.tx.us',
      'lib.ut.us',
      'lib.va.us',
      'lib.vi.us',
      'lib.vt.us',
      'lib.wa.us',
      'lib.wi.us',
      'lib.wy.us',
      'chtr.k12.ma.us',
      'paroch.k12.ma.us',
      'pvt.k12.ma.us',
      'ann-arbor.mi.us',
      'cog.mi.us',
      'dst.mi.us',
      'eaton.mi.us',
      'gen.mi.us',
      'mus.mi.us',
      'tec.mi.us',
      'washtenaw.mi.us',
      'uy',
      'com.uy',
      'edu.uy',
      'gub.uy',
      'mil.uy',
      'net.uy',
      'org.uy',
      'uz',
      'co.uz',
      'com.uz',
      'net.uz',
      'org.uz',
      'va',
      'vc',
      'com.vc',
      'edu.vc',
      'gov.vc',
      'mil.vc',
      'net.vc',
      'org.vc',
      've',
      'arts.ve',
      'bib.ve',
      'co.ve',
      'com.ve',
      'e12.ve',
      'edu.ve',
      'firm.ve',
      'gob.ve',
      'gov.ve',
      'info.ve',
      'int.ve',
      'mil.ve',
      'net.ve',
      'nom.ve',
      'org.ve',
      'rar.ve',
      'rec.ve',
      'store.ve',
      'tec.ve',
      'web.ve',
      'vg',
      'vi',
      'co.vi',
      'com.vi',
      'k12.vi',
      'net.vi',
      'org.vi',
      'vn',
      'ac.vn',
      'ai.vn',
      'biz.vn',
      'com.vn',
      'edu.vn',
      'gov.vn',
      'health.vn',
      'id.vn',
      'info.vn',
      'int.vn',
      'io.vn',
      'name.vn',
      'net.vn',
      'org.vn',
      'pro.vn',
      'angiang.vn',
      'bacgiang.vn',
      'backan.vn',
      'baclieu.vn',
      'bacninh.vn',
      'baria-vungtau.vn',
      'bentre.vn',
      'binhdinh.vn',
      'binhduong.vn',
      'binhphuoc.vn',
      'binhthuan.vn',
      'camau.vn',
      'cantho.vn',
      'caobang.vn',
      'daklak.vn',
      'daknong.vn',
      'danang.vn',
      'dienbien.vn',
      'dongnai.vn',
      'dongthap.vn',
      'gialai.vn',
      'hagiang.vn',
      'haiduong.vn',
      'haiphong.vn',
      'hanam.vn',
      'hanoi.vn',
      'hatinh.vn',
      'haugiang.vn',
      'hoabinh.vn',
      'hungyen.vn',
      'khanhhoa.vn',
      'kiengiang.vn',
      'kontum.vn',
      'laichau.vn',
      'lamdong.vn',
      'langson.vn',
      'laocai.vn',
      'longan.vn',
      'namdinh.vn',
      'nghean.vn',
      'ninhbinh.vn',
      'ninhthuan.vn',
      'phutho.vn',
      'phuyen.vn',
      'quangbinh.vn',
      'quangnam.vn',
      'quangngai.vn',
      'quangninh.vn',
      'quangtri.vn',
      'soctrang.vn',
      'sonla.vn',
      'tayninh.vn',
      'thaibinh.vn',
      'thainguyen.vn',
      'thanhhoa.vn',
      'thanhphohochiminh.vn',
      'thuathienhue.vn',
      'tiengiang.vn',
      'travinh.vn',
      'tuyenquang.vn',
      'vinhlong.vn',
      'vinhphuc.vn',
      'yenbai.vn',
      'vu',
      'com.vu',
      'edu.vu',
      'net.vu',
      'org.vu',
      'wf',
      'ws',
      'com.ws',
      'edu.ws',
      'gov.ws',
      'net.ws',
      'org.ws',
      'yt',
      '\u0627\u0645\u0627\u0631\u0627\u062A',
      '\u0570\u0561\u0575',
      '\u09AC\u09BE\u0982\u09B2\u09BE',
      '\u0431\u0433',
      '\u0627\u0644\u0628\u062D\u0631\u064A\u0646',
      '\u0431\u0435\u043B',
      '\u4E2D\u56FD',
      '\u4E2D\u570B',
      '\u0627\u0644\u062C\u0632\u0627\u0626\u0631',
      '\u0645\u0635\u0631',
      '\u0435\u044E',
      '\u03B5\u03C5',
      '\u0645\u0648\u0631\u064A\u062A\u0627\u0646\u064A\u0627',
      '\u10D2\u10D4',
      '\u03B5\u03BB',
      '\u9999\u6E2F',
      '\u500B\u4EBA.\u9999\u6E2F',
      '\u516C\u53F8.\u9999\u6E2F',
      '\u653F\u5E9C.\u9999\u6E2F',
      '\u6559\u80B2.\u9999\u6E2F',
      '\u7D44\u7E54.\u9999\u6E2F',
      '\u7DB2\u7D61.\u9999\u6E2F',
      '\u0CAD\u0CBE\u0CB0\u0CA4',
      '\u0B2D\u0B3E\u0B30\u0B24',
      '\u09AD\u09BE\u09F0\u09A4',
      '\u092D\u093E\u0930\u0924\u092E\u094D',
      '\u092D\u093E\u0930\u094B\u0924',
      '\u0680\u0627\u0631\u062A',
      '\u0D2D\u0D3E\u0D30\u0D24\u0D02',
      '\u092D\u093E\u0930\u0924',
      '\u0628\u0627\u0631\u062A',
      '\u0628\u06BE\u0627\u0631\u062A',
      '\u0C2D\u0C3E\u0C30\u0C24\u0C4D',
      '\u0AAD\u0ABE\u0AB0\u0AA4',
      '\u0A2D\u0A3E\u0A30\u0A24',
      '\u09AD\u09BE\u09B0\u09A4',
      '\u0B87\u0BA8\u0BCD\u0BA4\u0BBF\u0BAF\u0BBE',
      '\u0627\u06CC\u0631\u0627\u0646',
      '\u0627\u064A\u0631\u0627\u0646',
      '\u0639\u0631\u0627\u0642',
      '\u0627\u0644\u0627\u0631\u062F\u0646',
      '\uD55C\uAD6D',
      '\u049B\u0430\u0437',
      '\u0EA5\u0EB2\u0EA7',
      '\u0DBD\u0D82\u0D9A\u0DCF',
      '\u0B87\u0BB2\u0B99\u0BCD\u0B95\u0BC8',
      '\u0627\u0644\u0645\u063A\u0631\u0628',
      '\u043C\u043A\u0434',
      '\u043C\u043E\u043D',
      '\u6FB3\u9580',
      '\u6FB3\u95E8',
      '\u0645\u0644\u064A\u0633\u064A\u0627',
      '\u0639\u0645\u0627\u0646',
      '\u067E\u0627\u06A9\u0633\u062A\u0627\u0646',
      '\u067E\u0627\u0643\u0633\u062A\u0627\u0646',
      '\u0641\u0644\u0633\u0637\u064A\u0646',
      '\u0441\u0440\u0431',
      '\u0430\u043A.\u0441\u0440\u0431',
      '\u043E\u0431\u0440.\u0441\u0440\u0431',
      '\u043E\u0434.\u0441\u0440\u0431',
      '\u043E\u0440\u0433.\u0441\u0440\u0431',
      '\u043F\u0440.\u0441\u0440\u0431',
      '\u0443\u043F\u0440.\u0441\u0440\u0431',
      '\u0440\u0444',
      '\u0642\u0637\u0631',
      '\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629',
      '\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u0629',
      '\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u06C3',
      '\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0647',
      '\u0633\u0648\u062F\u0627\u0646',
      '\u65B0\u52A0\u5761',
      '\u0B9A\u0BBF\u0B99\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0BC2\u0BB0\u0BCD',
      '\u0633\u0648\u0631\u064A\u0629',
      '\u0633\u0648\u0631\u064A\u0627',
      '\u0E44\u0E17\u0E22',
      '\u0E17\u0E2B\u0E32\u0E23.\u0E44\u0E17\u0E22',
      '\u0E18\u0E38\u0E23\u0E01\u0E34\u0E08.\u0E44\u0E17\u0E22',
      '\u0E40\u0E19\u0E47\u0E15.\u0E44\u0E17\u0E22',
      '\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25.\u0E44\u0E17\u0E22',
      '\u0E28\u0E36\u0E01\u0E29\u0E32.\u0E44\u0E17\u0E22',
      '\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23.\u0E44\u0E17\u0E22',
      '\u062A\u0648\u0646\u0633',
      '\u53F0\u7063',
      '\u53F0\u6E7E',
      '\u81FA\u7063',
      '\u0443\u043A\u0440',
      '\u0627\u0644\u064A\u0645\u0646',
      'xxx',
      'ye',
      'com.ye',
      'edu.ye',
      'gov.ye',
      'mil.ye',
      'net.ye',
      'org.ye',
      'ac.za',
      'agric.za',
      'alt.za',
      'co.za',
      'edu.za',
      'gov.za',
      'grondar.za',
      'law.za',
      'mil.za',
      'net.za',
      'ngo.za',
      'nic.za',
      'nis.za',
      'nom.za',
      'org.za',
      'school.za',
      'tm.za',
      'web.za',
      'zm',
      'ac.zm',
      'biz.zm',
      'co.zm',
      'com.zm',
      'edu.zm',
      'gov.zm',
      'info.zm',
      'mil.zm',
      'net.zm',
      'org.zm',
      'sch.zm',
      'zw',
      'ac.zw',
      'co.zw',
      'gov.zw',
      'mil.zw',
      'org.zw',
      'aaa',
      'aarp',
      'abb',
      'abbott',
      'abbvie',
      'abc',
      'able',
      'abogado',
      'abudhabi',
      'academy',
      'accenture',
      'accountant',
      'accountants',
      'aco',
      'actor',
      'ads',
      'adult',
      'aeg',
      'aetna',
      'afl',
      'africa',
      'agakhan',
      'agency',
      'aig',
      'airbus',
      'airforce',
      'airtel',
      'akdn',
      'alibaba',
      'alipay',
      'allfinanz',
      'allstate',
      'ally',
      'alsace',
      'alstom',
      'amazon',
      'americanexpress',
      'americanfamily',
      'amex',
      'amfam',
      'amica',
      'amsterdam',
      'analytics',
      'android',
      'anquan',
      'anz',
      'aol',
      'apartments',
      'app',
      'apple',
      'aquarelle',
      'arab',
      'aramco',
      'archi',
      'army',
      'art',
      'arte',
      'asda',
      'associates',
      'athleta',
      'attorney',
      'auction',
      'audi',
      'audible',
      'audio',
      'auspost',
      'author',
      'auto',
      'autos',
      'aws',
      'axa',
      'azure',
      'baby',
      'baidu',
      'banamex',
      'band',
      'bank',
      'bar',
      'barcelona',
      'barclaycard',
      'barclays',
      'barefoot',
      'bargains',
      'baseball',
      'basketball',
      'bauhaus',
      'bayern',
      'bbc',
      'bbt',
      'bbva',
      'bcg',
      'bcn',
      'beats',
      'beauty',
      'beer',
      'bentley',
      'berlin',
      'best',
      'bestbuy',
      'bet',
      'bharti',
      'bible',
      'bid',
      'bike',
      'bing',
      'bingo',
      'bio',
      'black',
      'blackfriday',
      'blockbuster',
      'blog',
      'bloomberg',
      'blue',
      'bms',
      'bmw',
      'bnpparibas',
      'boats',
      'boehringer',
      'bofa',
      'bom',
      'bond',
      'boo',
      'book',
      'booking',
      'bosch',
      'bostik',
      'boston',
      'bot',
      'boutique',
      'box',
      'bradesco',
      'bridgestone',
      'broadway',
      'broker',
      'brother',
      'brussels',
      'build',
      'builders',
      'business',
      'buy',
      'buzz',
      'bzh',
      'cab',
      'cafe',
      'cal',
      'call',
      'calvinklein',
      'cam',
      'camera',
      'camp',
      'canon',
      'capetown',
      'capital',
      'capitalone',
      'car',
      'caravan',
      'cards',
      'care',
      'career',
      'careers',
      'cars',
      'casa',
      'case',
      'cash',
      'casino',
      'catering',
      'catholic',
      'cba',
      'cbn',
      'cbre',
      'center',
      'ceo',
      'cern',
      'cfa',
      'cfd',
      'chanel',
      'channel',
      'charity',
      'chase',
      'chat',
      'cheap',
      'chintai',
      'christmas',
      'chrome',
      'church',
      'cipriani',
      'circle',
      'cisco',
      'citadel',
      'citi',
      'citic',
      'city',
      'claims',
      'cleaning',
      'click',
      'clinic',
      'clinique',
      'clothing',
      'cloud',
      'club',
      'clubmed',
      'coach',
      'codes',
      'coffee',
      'college',
      'cologne',
      'commbank',
      'community',
      'company',
      'compare',
      'computer',
      'comsec',
      'condos',
      'construction',
      'consulting',
      'contact',
      'contractors',
      'cooking',
      'cool',
      'corsica',
      'country',
      'coupon',
      'coupons',
      'courses',
      'cpa',
      'credit',
      'creditcard',
      'creditunion',
      'cricket',
      'crown',
      'crs',
      'cruise',
      'cruises',
      'cuisinella',
      'cymru',
      'cyou',
      'dad',
      'dance',
      'data',
      'date',
      'dating',
      'datsun',
      'day',
      'dclk',
      'dds',
      'deal',
      'dealer',
      'deals',
      'degree',
      'delivery',
      'dell',
      'deloitte',
      'delta',
      'democrat',
      'dental',
      'dentist',
      'desi',
      'design',
      'dev',
      'dhl',
      'diamonds',
      'diet',
      'digital',
      'direct',
      'directory',
      'discount',
      'discover',
      'dish',
      'diy',
      'dnp',
      'docs',
      'doctor',
      'dog',
      'domains',
      'dot',
      'download',
      'drive',
      'dtv',
      'dubai',
      'dunlop',
      'dupont',
      'durban',
      'dvag',
      'dvr',
      'earth',
      'eat',
      'eco',
      'edeka',
      'education',
      'email',
      'emerck',
      'energy',
      'engineer',
      'engineering',
      'enterprises',
      'epson',
      'equipment',
      'ericsson',
      'erni',
      'esq',
      'estate',
      'eurovision',
      'eus',
      'events',
      'exchange',
      'expert',
      'exposed',
      'express',
      'extraspace',
      'fage',
      'fail',
      'fairwinds',
      'faith',
      'family',
      'fan',
      'fans',
      'farm',
      'farmers',
      'fashion',
      'fast',
      'fedex',
      'feedback',
      'ferrari',
      'ferrero',
      'fidelity',
      'fido',
      'film',
      'final',
      'finance',
      'financial',
      'fire',
      'firestone',
      'firmdale',
      'fish',
      'fishing',
      'fit',
      'fitness',
      'flickr',
      'flights',
      'flir',
      'florist',
      'flowers',
      'fly',
      'foo',
      'food',
      'football',
      'ford',
      'forex',
      'forsale',
      'forum',
      'foundation',
      'fox',
      'free',
      'fresenius',
      'frl',
      'frogans',
      'frontier',
      'ftr',
      'fujitsu',
      'fun',
      'fund',
      'furniture',
      'futbol',
      'fyi',
      'gal',
      'gallery',
      'gallo',
      'gallup',
      'game',
      'games',
      'gap',
      'garden',
      'gay',
      'gbiz',
      'gdn',
      'gea',
      'gent',
      'genting',
      'george',
      'ggee',
      'gift',
      'gifts',
      'gives',
      'giving',
      'glass',
      'gle',
      'global',
      'globo',
      'gmail',
      'gmbh',
      'gmo',
      'gmx',
      'godaddy',
      'gold',
      'goldpoint',
      'golf',
      'goo',
      'goodyear',
      'goog',
      'google',
      'gop',
      'got',
      'grainger',
      'graphics',
      'gratis',
      'green',
      'gripe',
      'grocery',
      'group',
      'gucci',
      'guge',
      'guide',
      'guitars',
      'guru',
      'hair',
      'hamburg',
      'hangout',
      'haus',
      'hbo',
      'hdfc',
      'hdfcbank',
      'health',
      'healthcare',
      'help',
      'helsinki',
      'here',
      'hermes',
      'hiphop',
      'hisamitsu',
      'hitachi',
      'hiv',
      'hkt',
      'hockey',
      'holdings',
      'holiday',
      'homedepot',
      'homegoods',
      'homes',
      'homesense',
      'honda',
      'horse',
      'hospital',
      'host',
      'hosting',
      'hot',
      'hotels',
      'hotmail',
      'house',
      'how',
      'hsbc',
      'hughes',
      'hyatt',
      'hyundai',
      'ibm',
      'icbc',
      'ice',
      'icu',
      'ieee',
      'ifm',
      'ikano',
      'imamat',
      'imdb',
      'immo',
      'immobilien',
      'inc',
      'industries',
      'infiniti',
      'ing',
      'ink',
      'institute',
      'insurance',
      'insure',
      'international',
      'intuit',
      'investments',
      'ipiranga',
      'irish',
      'ismaili',
      'ist',
      'istanbul',
      'itau',
      'itv',
      'jaguar',
      'java',
      'jcb',
      'jeep',
      'jetzt',
      'jewelry',
      'jio',
      'jll',
      'jmp',
      'jnj',
      'joburg',
      'jot',
      'joy',
      'jpmorgan',
      'jprs',
      'juegos',
      'juniper',
      'kaufen',
      'kddi',
      'kerryhotels',
      'kerrylogistics',
      'kerryproperties',
      'kfh',
      'kia',
      'kids',
      'kim',
      'kindle',
      'kitchen',
      'kiwi',
      'koeln',
      'komatsu',
      'kosher',
      'kpmg',
      'kpn',
      'krd',
      'kred',
      'kuokgroup',
      'kyoto',
      'lacaixa',
      'lamborghini',
      'lamer',
      'lancaster',
      'land',
      'landrover',
      'lanxess',
      'lasalle',
      'lat',
      'latino',
      'latrobe',
      'law',
      'lawyer',
      'lds',
      'lease',
      'leclerc',
      'lefrak',
      'legal',
      'lego',
      'lexus',
      'lgbt',
      'lidl',
      'life',
      'lifeinsurance',
      'lifestyle',
      'lighting',
      'like',
      'lilly',
      'limited',
      'limo',
      'lincoln',
      'link',
      'lipsy',
      'live',
      'living',
      'llc',
      'llp',
      'loan',
      'loans',
      'locker',
      'locus',
      'lol',
      'london',
      'lotte',
      'lotto',
      'love',
      'lpl',
      'lplfinancial',
      'ltd',
      'ltda',
      'lundbeck',
      'luxe',
      'luxury',
      'madrid',
      'maif',
      'maison',
      'makeup',
      'man',
      'management',
      'mango',
      'map',
      'market',
      'marketing',
      'markets',
      'marriott',
      'marshalls',
      'mattel',
      'mba',
      'mckinsey',
      'med',
      'media',
      'meet',
      'melbourne',
      'meme',
      'memorial',
      'men',
      'menu',
      'merck',
      'merckmsd',
      'miami',
      'microsoft',
      'mini',
      'mint',
      'mit',
      'mitsubishi',
      'mlb',
      'mls',
      'mma',
      'mobile',
      'moda',
      'moe',
      'moi',
      'mom',
      'monash',
      'money',
      'monster',
      'mormon',
      'mortgage',
      'moscow',
      'moto',
      'motorcycles',
      'mov',
      'movie',
      'msd',
      'mtn',
      'mtr',
      'music',
      'nab',
      'nagoya',
      'navy',
      'nba',
      'nec',
      'netbank',
      'netflix',
      'network',
      'neustar',
      'new',
      'news',
      'next',
      'nextdirect',
      'nexus',
      'nfl',
      'ngo',
      'nhk',
      'nico',
      'nike',
      'nikon',
      'ninja',
      'nissan',
      'nissay',
      'nokia',
      'norton',
      'now',
      'nowruz',
      'nowtv',
      'nra',
      'nrw',
      'ntt',
      'nyc',
      'obi',
      'observer',
      'office',
      'okinawa',
      'olayan',
      'olayangroup',
      'ollo',
      'omega',
      'one',
      'ong',
      'onl',
      'online',
      'ooo',
      'open',
      'oracle',
      'orange',
      'organic',
      'origins',
      'osaka',
      'otsuka',
      'ott',
      'ovh',
      'page',
      'panasonic',
      'paris',
      'pars',
      'partners',
      'parts',
      'party',
      'pay',
      'pccw',
      'pet',
      'pfizer',
      'pharmacy',
      'phd',
      'philips',
      'phone',
      'photo',
      'photography',
      'photos',
      'physio',
      'pics',
      'pictet',
      'pictures',
      'pid',
      'pin',
      'ping',
      'pink',
      'pioneer',
      'pizza',
      'place',
      'play',
      'playstation',
      'plumbing',
      'plus',
      'pnc',
      'pohl',
      'poker',
      'politie',
      'porn',
      'pramerica',
      'praxi',
      'press',
      'prime',
      'prod',
      'productions',
      'prof',
      'progressive',
      'promo',
      'properties',
      'property',
      'protection',
      'pru',
      'prudential',
      'pub',
      'pwc',
      'qpon',
      'quebec',
      'quest',
      'racing',
      'radio',
      'read',
      'realestate',
      'realtor',
      'realty',
      'recipes',
      'red',
      'redstone',
      'redumbrella',
      'rehab',
      'reise',
      'reisen',
      'reit',
      'reliance',
      'ren',
      'rent',
      'rentals',
      'repair',
      'report',
      'republican',
      'rest',
      'restaurant',
      'review',
      'reviews',
      'rexroth',
      'rich',
      'richardli',
      'ricoh',
      'ril',
      'rio',
      'rip',
      'rocks',
      'rodeo',
      'rogers',
      'room',
      'rsvp',
      'rugby',
      'ruhr',
      'run',
      'rwe',
      'ryukyu',
      'saarland',
      'safe',
      'safety',
      'sakura',
      'sale',
      'salon',
      'samsclub',
      'samsung',
      'sandvik',
      'sandvikcoromant',
      'sanofi',
      'sap',
      'sarl',
      'sas',
      'save',
      'saxo',
      'sbi',
      'sbs',
      'scb',
      'schaeffler',
      'schmidt',
      'scholarships',
      'school',
      'schule',
      'schwarz',
      'science',
      'scot',
      'search',
      'seat',
      'secure',
      'security',
      'seek',
      'select',
      'sener',
      'services',
      'seven',
      'sew',
      'sex',
      'sexy',
      'sfr',
      'shangrila',
      'sharp',
      'shell',
      'shia',
      'shiksha',
      'shoes',
      'shop',
      'shopping',
      'shouji',
      'show',
      'silk',
      'sina',
      'singles',
      'site',
      'ski',
      'skin',
      'sky',
      'skype',
      'sling',
      'smart',
      'smile',
      'sncf',
      'soccer',
      'social',
      'softbank',
      'software',
      'sohu',
      'solar',
      'solutions',
      'song',
      'sony',
      'soy',
      'spa',
      'space',
      'sport',
      'spot',
      'srl',
      'stada',
      'staples',
      'star',
      'statebank',
      'statefarm',
      'stc',
      'stcgroup',
      'stockholm',
      'storage',
      'store',
      'stream',
      'studio',
      'study',
      'style',
      'sucks',
      'supplies',
      'supply',
      'support',
      'surf',
      'surgery',
      'suzuki',
      'swatch',
      'swiss',
      'sydney',
      'systems',
      'tab',
      'taipei',
      'talk',
      'taobao',
      'target',
      'tatamotors',
      'tatar',
      'tattoo',
      'tax',
      'taxi',
      'tci',
      'tdk',
      'team',
      'tech',
      'technology',
      'temasek',
      'tennis',
      'teva',
      'thd',
      'theater',
      'theatre',
      'tiaa',
      'tickets',
      'tienda',
      'tips',
      'tires',
      'tirol',
      'tjmaxx',
      'tjx',
      'tkmaxx',
      'tmall',
      'today',
      'tokyo',
      'tools',
      'top',
      'toray',
      'toshiba',
      'total',
      'tours',
      'town',
      'toyota',
      'toys',
      'trade',
      'trading',
      'training',
      'travel',
      'travelers',
      'travelersinsurance',
      'trust',
      'trv',
      'tube',
      'tui',
      'tunes',
      'tushu',
      'tvs',
      'ubank',
      'ubs',
      'unicom',
      'university',
      'uno',
      'uol',
      'ups',
      'vacations',
      'vana',
      'vanguard',
      'vegas',
      'ventures',
      'verisign',
      'versicherung',
      'vet',
      'viajes',
      'video',
      'vig',
      'viking',
      'villas',
      'vin',
      'vip',
      'virgin',
      'visa',
      'vision',
      'viva',
      'vivo',
      'vlaanderen',
      'vodka',
      'volvo',
      'vote',
      'voting',
      'voto',
      'voyage',
      'wales',
      'walmart',
      'walter',
      'wang',
      'wanggou',
      'watch',
      'watches',
      'weather',
      'weatherchannel',
      'webcam',
      'weber',
      'website',
      'wed',
      'wedding',
      'weibo',
      'weir',
      'whoswho',
      'wien',
      'wiki',
      'williamhill',
      'win',
      'windows',
      'wine',
      'winners',
      'wme',
      'wolterskluwer',
      'woodside',
      'work',
      'works',
      'world',
      'wow',
      'wtc',
      'wtf',
      'xbox',
      'xerox',
      'xihuan',
      'xin',
      '\u0915\u0949\u092E',
      '\u30BB\u30FC\u30EB',
      '\u4F5B\u5C71',
      '\u6148\u5584',
      '\u96C6\u56E2',
      '\u5728\u7EBF',
      '\u70B9\u770B',
      '\u0E04\u0E2D\u0E21',
      '\u516B\u5366',
      '\u0645\u0648\u0642\u0639',
      '\u516C\u76CA',
      '\u516C\u53F8',
      '\u9999\u683C\u91CC\u62C9',
      '\u7F51\u7AD9',
      '\u79FB\u52A8',
      '\u6211\u7231\u4F60',
      '\u043C\u043E\u0441\u043A\u0432\u0430',
      '\u043A\u0430\u0442\u043E\u043B\u0438\u043A',
      '\u043E\u043D\u043B\u0430\u0439\u043D',
      '\u0441\u0430\u0439\u0442',
      '\u8054\u901A',
      '\u05E7\u05D5\u05DD',
      '\u65F6\u5C1A',
      '\u5FAE\u535A',
      '\u6DE1\u9A6C\u9521',
      '\u30D5\u30A1\u30C3\u30B7\u30E7\u30F3',
      '\u043E\u0440\u0433',
      '\u0928\u0947\u091F',
      '\u30B9\u30C8\u30A2',
      '\u30A2\u30DE\u30BE\u30F3',
      '\uC0BC\uC131',
      '\u5546\u6807',
      '\u5546\u5E97',
      '\u5546\u57CE',
      '\u0434\u0435\u0442\u0438',
      '\u30DD\u30A4\u30F3\u30C8',
      '\u65B0\u95FB',
      '\u5BB6\u96FB',
      '\u0643\u0648\u0645',
      '\u4E2D\u6587\u7F51',
      '\u4E2D\u4FE1',
      '\u5A31\u4E50',
      '\u8C37\u6B4C',
      '\u96FB\u8A0A\u76C8\u79D1',
      '\u8D2D\u7269',
      '\u30AF\u30E9\u30A6\u30C9',
      '\u901A\u8CA9',
      '\u7F51\u5E97',
      '\u0938\u0902\u0917\u0920\u0928',
      '\u9910\u5385',
      '\u7F51\u7EDC',
      '\u043A\u043E\u043C',
      '\u4E9A\u9A6C\u900A',
      '\u98DF\u54C1',
      '\u98DE\u5229\u6D66',
      '\u624B\u673A',
      '\u0627\u0631\u0627\u0645\u0643\u0648',
      '\u0627\u0644\u0639\u0644\u064A\u0627\u0646',
      '\u0628\u0627\u0632\u0627\u0631',
      '\u0627\u0628\u0648\u0638\u0628\u064A',
      '\u0643\u0627\u062B\u0648\u0644\u064A\u0643',
      '\u0647\u0645\u0631\u0627\u0647',
      '\uB2F7\uCEF4',
      '\u653F\u5E9C',
      '\u0634\u0628\u0643\u0629',
      '\u0628\u064A\u062A\u0643',
      '\u0639\u0631\u0628',
      '\u673A\u6784',
      '\u7EC4\u7EC7\u673A\u6784',
      '\u5065\u5EB7',
      '\u62DB\u8058',
      '\u0440\u0443\u0441',
      '\u5927\u62FF',
      '\u307F\u3093\u306A',
      '\u30B0\u30FC\u30B0\u30EB',
      '\u4E16\u754C',
      '\u66F8\u7C4D',
      '\u7F51\u5740',
      '\uB2F7\uB137',
      '\u30B3\u30E0',
      '\u5929\u4E3B\u6559',
      '\u6E38\u620F',
      'verm\xF6gensberater',
      'verm\xF6gensberatung',
      '\u4F01\u4E1A',
      '\u4FE1\u606F',
      '\u5609\u91CC\u5927\u9152\u5E97',
      '\u5609\u91CC',
      '\u5E7F\u4E1C',
      '\u653F\u52A1',
      'xyz',
      'yachts',
      'yahoo',
      'yamaxun',
      'yandex',
      'yodobashi',
      'yoga',
      'yokohama',
      'you',
      'youtube',
      'yun',
      'zappos',
      'zara',
      'zero',
      'zip',
      'zone',
      'zuerich',
      'co.krd',
      'edu.krd',
      'art.pl',
      'gliwice.pl',
      'krakow.pl',
      'poznan.pl',
      'wroc.pl',
      'zakopane.pl',
      'lib.de.us',
      '12chars.dev',
      '12chars.it',
      '12chars.pro',
      'cc.ua',
      'inf.ua',
      'ltd.ua',
      '611.to',
      'a2hosted.com',
      'cpserver.com',
      'aaa.vodka',
      '*.on-acorn.io',
      'activetrail.biz',
      'adaptable.app',
      'adobeaemcloud.com',
      '*.dev.adobeaemcloud.com',
      'aem.live',
      'hlx.live',
      'adobeaemcloud.net',
      'aem.page',
      'hlx.page',
      'hlx3.page',
      'adobeio-static.net',
      'adobeioruntime.net',
      'africa.com',
      'beep.pl',
      'airkitapps.com',
      'airkitapps-au.com',
      'airkitapps.eu',
      'aivencloud.com',
      'akadns.net',
      'akamai.net',
      'akamai-staging.net',
      'akamaiedge.net',
      'akamaiedge-staging.net',
      'akamaihd.net',
      'akamaihd-staging.net',
      'akamaiorigin.net',
      'akamaiorigin-staging.net',
      'akamaized.net',
      'akamaized-staging.net',
      'edgekey.net',
      'edgekey-staging.net',
      'edgesuite.net',
      'edgesuite-staging.net',
      'barsy.ca',
      '*.compute.estate',
      '*.alces.network',
      'kasserver.com',
      'altervista.org',
      'alwaysdata.net',
      'myamaze.net',
      'execute-api.cn-north-1.amazonaws.com.cn',
      'execute-api.cn-northwest-1.amazonaws.com.cn',
      'execute-api.af-south-1.amazonaws.com',
      'execute-api.ap-east-1.amazonaws.com',
      'execute-api.ap-northeast-1.amazonaws.com',
      'execute-api.ap-northeast-2.amazonaws.com',
      'execute-api.ap-northeast-3.amazonaws.com',
      'execute-api.ap-south-1.amazonaws.com',
      'execute-api.ap-south-2.amazonaws.com',
      'execute-api.ap-southeast-1.amazonaws.com',
      'execute-api.ap-southeast-2.amazonaws.com',
      'execute-api.ap-southeast-3.amazonaws.com',
      'execute-api.ap-southeast-4.amazonaws.com',
      'execute-api.ap-southeast-5.amazonaws.com',
      'execute-api.ca-central-1.amazonaws.com',
      'execute-api.ca-west-1.amazonaws.com',
      'execute-api.eu-central-1.amazonaws.com',
      'execute-api.eu-central-2.amazonaws.com',
      'execute-api.eu-north-1.amazonaws.com',
      'execute-api.eu-south-1.amazonaws.com',
      'execute-api.eu-south-2.amazonaws.com',
      'execute-api.eu-west-1.amazonaws.com',
      'execute-api.eu-west-2.amazonaws.com',
      'execute-api.eu-west-3.amazonaws.com',
      'execute-api.il-central-1.amazonaws.com',
      'execute-api.me-central-1.amazonaws.com',
      'execute-api.me-south-1.amazonaws.com',
      'execute-api.sa-east-1.amazonaws.com',
      'execute-api.us-east-1.amazonaws.com',
      'execute-api.us-east-2.amazonaws.com',
      'execute-api.us-gov-east-1.amazonaws.com',
      'execute-api.us-gov-west-1.amazonaws.com',
      'execute-api.us-west-1.amazonaws.com',
      'execute-api.us-west-2.amazonaws.com',
      'cloudfront.net',
      'auth.af-south-1.amazoncognito.com',
      'auth.ap-east-1.amazoncognito.com',
      'auth.ap-northeast-1.amazoncognito.com',
      'auth.ap-northeast-2.amazoncognito.com',
      'auth.ap-northeast-3.amazoncognito.com',
      'auth.ap-south-1.amazoncognito.com',
      'auth.ap-south-2.amazoncognito.com',
      'auth.ap-southeast-1.amazoncognito.com',
      'auth.ap-southeast-2.amazoncognito.com',
      'auth.ap-southeast-3.amazoncognito.com',
      'auth.ap-southeast-4.amazoncognito.com',
      'auth.ca-central-1.amazoncognito.com',
      'auth.ca-west-1.amazoncognito.com',
      'auth.eu-central-1.amazoncognito.com',
      'auth.eu-central-2.amazoncognito.com',
      'auth.eu-north-1.amazoncognito.com',
      'auth.eu-south-1.amazoncognito.com',
      'auth.eu-south-2.amazoncognito.com',
      'auth.eu-west-1.amazoncognito.com',
      'auth.eu-west-2.amazoncognito.com',
      'auth.eu-west-3.amazoncognito.com',
      'auth.il-central-1.amazoncognito.com',
      'auth.me-central-1.amazoncognito.com',
      'auth.me-south-1.amazoncognito.com',
      'auth.sa-east-1.amazoncognito.com',
      'auth.us-east-1.amazoncognito.com',
      'auth-fips.us-east-1.amazoncognito.com',
      'auth.us-east-2.amazoncognito.com',
      'auth-fips.us-east-2.amazoncognito.com',
      'auth-fips.us-gov-west-1.amazoncognito.com',
      'auth.us-west-1.amazoncognito.com',
      'auth-fips.us-west-1.amazoncognito.com',
      'auth.us-west-2.amazoncognito.com',
      'auth-fips.us-west-2.amazoncognito.com',
      '*.compute.amazonaws.com.cn',
      '*.compute.amazonaws.com',
      '*.compute-1.amazonaws.com',
      'us-east-1.amazonaws.com',
      'emrappui-prod.cn-north-1.amazonaws.com.cn',
      'emrnotebooks-prod.cn-north-1.amazonaws.com.cn',
      'emrstudio-prod.cn-north-1.amazonaws.com.cn',
      'emrappui-prod.cn-northwest-1.amazonaws.com.cn',
      'emrnotebooks-prod.cn-northwest-1.amazonaws.com.cn',
      'emrstudio-prod.cn-northwest-1.amazonaws.com.cn',
      'emrappui-prod.af-south-1.amazonaws.com',
      'emrnotebooks-prod.af-south-1.amazonaws.com',
      'emrstudio-prod.af-south-1.amazonaws.com',
      'emrappui-prod.ap-east-1.amazonaws.com',
      'emrnotebooks-prod.ap-east-1.amazonaws.com',
      'emrstudio-prod.ap-east-1.amazonaws.com',
      'emrappui-prod.ap-northeast-1.amazonaws.com',
      'emrnotebooks-prod.ap-northeast-1.amazonaws.com',
      'emrstudio-prod.ap-northeast-1.amazonaws.com',
      'emrappui-prod.ap-northeast-2.amazonaws.com',
      'emrnotebooks-prod.ap-northeast-2.amazonaws.com',
      'emrstudio-prod.ap-northeast-2.amazonaws.com',
      'emrappui-prod.ap-northeast-3.amazonaws.com',
      'emrnotebooks-prod.ap-northeast-3.amazonaws.com',
      'emrstudio-prod.ap-northeast-3.amazonaws.com',
      'emrappui-prod.ap-south-1.amazonaws.com',
      'emrnotebooks-prod.ap-south-1.amazonaws.com',
      'emrstudio-prod.ap-south-1.amazonaws.com',
      'emrappui-prod.ap-south-2.amazonaws.com',
      'emrnotebooks-prod.ap-south-2.amazonaws.com',
      'emrstudio-prod.ap-south-2.amazonaws.com',
      'emrappui-prod.ap-southeast-1.amazonaws.com',
      'emrnotebooks-prod.ap-southeast-1.amazonaws.com',
      'emrstudio-prod.ap-southeast-1.amazonaws.com',
      'emrappui-prod.ap-southeast-2.amazonaws.com',
      'emrnotebooks-prod.ap-southeast-2.amazonaws.com',
      'emrstudio-prod.ap-southeast-2.amazonaws.com',
      'emrappui-prod.ap-southeast-3.amazonaws.com',
      'emrnotebooks-prod.ap-southeast-3.amazonaws.com',
      'emrstudio-prod.ap-southeast-3.amazonaws.com',
      'emrappui-prod.ap-southeast-4.amazonaws.com',
      'emrnotebooks-prod.ap-southeast-4.amazonaws.com',
      'emrstudio-prod.ap-southeast-4.amazonaws.com',
      'emrappui-prod.ca-central-1.amazonaws.com',
      'emrnotebooks-prod.ca-central-1.amazonaws.com',
      'emrstudio-prod.ca-central-1.amazonaws.com',
      'emrappui-prod.ca-west-1.amazonaws.com',
      'emrnotebooks-prod.ca-west-1.amazonaws.com',
      'emrstudio-prod.ca-west-1.amazonaws.com',
      'emrappui-prod.eu-central-1.amazonaws.com',
      'emrnotebooks-prod.eu-central-1.amazonaws.com',
      'emrstudio-prod.eu-central-1.amazonaws.com',
      'emrappui-prod.eu-central-2.amazonaws.com',
      'emrnotebooks-prod.eu-central-2.amazonaws.com',
      'emrstudio-prod.eu-central-2.amazonaws.com',
      'emrappui-prod.eu-north-1.amazonaws.com',
      'emrnotebooks-prod.eu-north-1.amazonaws.com',
      'emrstudio-prod.eu-north-1.amazonaws.com',
      'emrappui-prod.eu-south-1.amazonaws.com',
      'emrnotebooks-prod.eu-south-1.amazonaws.com',
      'emrstudio-prod.eu-south-1.amazonaws.com',
      'emrappui-prod.eu-south-2.amazonaws.com',
      'emrnotebooks-prod.eu-south-2.amazonaws.com',
      'emrstudio-prod.eu-south-2.amazonaws.com',
      'emrappui-prod.eu-west-1.amazonaws.com',
      'emrnotebooks-prod.eu-west-1.amazonaws.com',
      'emrstudio-prod.eu-west-1.amazonaws.com',
      'emrappui-prod.eu-west-2.amazonaws.com',
      'emrnotebooks-prod.eu-west-2.amazonaws.com',
      'emrstudio-prod.eu-west-2.amazonaws.com',
      'emrappui-prod.eu-west-3.amazonaws.com',
      'emrnotebooks-prod.eu-west-3.amazonaws.com',
      'emrstudio-prod.eu-west-3.amazonaws.com',
      'emrappui-prod.il-central-1.amazonaws.com',
      'emrnotebooks-prod.il-central-1.amazonaws.com',
      'emrstudio-prod.il-central-1.amazonaws.com',
      'emrappui-prod.me-central-1.amazonaws.com',
      'emrnotebooks-prod.me-central-1.amazonaws.com',
      'emrstudio-prod.me-central-1.amazonaws.com',
      'emrappui-prod.me-south-1.amazonaws.com',
      'emrnotebooks-prod.me-south-1.amazonaws.com',
      'emrstudio-prod.me-south-1.amazonaws.com',
      'emrappui-prod.sa-east-1.amazonaws.com',
      'emrnotebooks-prod.sa-east-1.amazonaws.com',
      'emrstudio-prod.sa-east-1.amazonaws.com',
      'emrappui-prod.us-east-1.amazonaws.com',
      'emrnotebooks-prod.us-east-1.amazonaws.com',
      'emrstudio-prod.us-east-1.amazonaws.com',
      'emrappui-prod.us-east-2.amazonaws.com',
      'emrnotebooks-prod.us-east-2.amazonaws.com',
      'emrstudio-prod.us-east-2.amazonaws.com',
      'emrappui-prod.us-gov-east-1.amazonaws.com',
      'emrnotebooks-prod.us-gov-east-1.amazonaws.com',
      'emrstudio-prod.us-gov-east-1.amazonaws.com',
      'emrappui-prod.us-gov-west-1.amazonaws.com',
      'emrnotebooks-prod.us-gov-west-1.amazonaws.com',
      'emrstudio-prod.us-gov-west-1.amazonaws.com',
      'emrappui-prod.us-west-1.amazonaws.com',
      'emrnotebooks-prod.us-west-1.amazonaws.com',
      'emrstudio-prod.us-west-1.amazonaws.com',
      'emrappui-prod.us-west-2.amazonaws.com',
      'emrnotebooks-prod.us-west-2.amazonaws.com',
      'emrstudio-prod.us-west-2.amazonaws.com',
      '*.cn-north-1.airflow.amazonaws.com.cn',
      '*.cn-northwest-1.airflow.amazonaws.com.cn',
      '*.af-south-1.airflow.amazonaws.com',
      '*.ap-east-1.airflow.amazonaws.com',
      '*.ap-northeast-1.airflow.amazonaws.com',
      '*.ap-northeast-2.airflow.amazonaws.com',
      '*.ap-northeast-3.airflow.amazonaws.com',
      '*.ap-south-1.airflow.amazonaws.com',
      '*.ap-south-2.airflow.amazonaws.com',
      '*.ap-southeast-1.airflow.amazonaws.com',
      '*.ap-southeast-2.airflow.amazonaws.com',
      '*.ap-southeast-3.airflow.amazonaws.com',
      '*.ap-southeast-4.airflow.amazonaws.com',
      '*.ca-central-1.airflow.amazonaws.com',
      '*.ca-west-1.airflow.amazonaws.com',
      '*.eu-central-1.airflow.amazonaws.com',
      '*.eu-central-2.airflow.amazonaws.com',
      '*.eu-north-1.airflow.amazonaws.com',
      '*.eu-south-1.airflow.amazonaws.com',
      '*.eu-south-2.airflow.amazonaws.com',
      '*.eu-west-1.airflow.amazonaws.com',
      '*.eu-west-2.airflow.amazonaws.com',
      '*.eu-west-3.airflow.amazonaws.com',
      '*.il-central-1.airflow.amazonaws.com',
      '*.me-central-1.airflow.amazonaws.com',
      '*.me-south-1.airflow.amazonaws.com',
      '*.sa-east-1.airflow.amazonaws.com',
      '*.us-east-1.airflow.amazonaws.com',
      '*.us-east-2.airflow.amazonaws.com',
      '*.us-west-1.airflow.amazonaws.com',
      '*.us-west-2.airflow.amazonaws.com',
      's3.dualstack.cn-north-1.amazonaws.com.cn',
      's3-accesspoint.dualstack.cn-north-1.amazonaws.com.cn',
      's3-website.dualstack.cn-north-1.amazonaws.com.cn',
      's3.cn-north-1.amazonaws.com.cn',
      's3-accesspoint.cn-north-1.amazonaws.com.cn',
      's3-deprecated.cn-north-1.amazonaws.com.cn',
      's3-object-lambda.cn-north-1.amazonaws.com.cn',
      's3-website.cn-north-1.amazonaws.com.cn',
      's3.dualstack.cn-northwest-1.amazonaws.com.cn',
      's3-accesspoint.dualstack.cn-northwest-1.amazonaws.com.cn',
      's3.cn-northwest-1.amazonaws.com.cn',
      's3-accesspoint.cn-northwest-1.amazonaws.com.cn',
      's3-object-lambda.cn-northwest-1.amazonaws.com.cn',
      's3-website.cn-northwest-1.amazonaws.com.cn',
      's3.dualstack.af-south-1.amazonaws.com',
      's3-accesspoint.dualstack.af-south-1.amazonaws.com',
      's3-website.dualstack.af-south-1.amazonaws.com',
      's3.af-south-1.amazonaws.com',
      's3-accesspoint.af-south-1.amazonaws.com',
      's3-object-lambda.af-south-1.amazonaws.com',
      's3-website.af-south-1.amazonaws.com',
      's3.dualstack.ap-east-1.amazonaws.com',
      's3-accesspoint.dualstack.ap-east-1.amazonaws.com',
      's3.ap-east-1.amazonaws.com',
      's3-accesspoint.ap-east-1.amazonaws.com',
      's3-object-lambda.ap-east-1.amazonaws.com',
      's3-website.ap-east-1.amazonaws.com',
      's3.dualstack.ap-northeast-1.amazonaws.com',
      's3-accesspoint.dualstack.ap-northeast-1.amazonaws.com',
      's3-website.dualstack.ap-northeast-1.amazonaws.com',
      's3.ap-northeast-1.amazonaws.com',
      's3-accesspoint.ap-northeast-1.amazonaws.com',
      's3-object-lambda.ap-northeast-1.amazonaws.com',
      's3-website.ap-northeast-1.amazonaws.com',
      's3.dualstack.ap-northeast-2.amazonaws.com',
      's3-accesspoint.dualstack.ap-northeast-2.amazonaws.com',
      's3-website.dualstack.ap-northeast-2.amazonaws.com',
      's3.ap-northeast-2.amazonaws.com',
      's3-accesspoint.ap-northeast-2.amazonaws.com',
      's3-object-lambda.ap-northeast-2.amazonaws.com',
      's3-website.ap-northeast-2.amazonaws.com',
      's3.dualstack.ap-northeast-3.amazonaws.com',
      's3-accesspoint.dualstack.ap-northeast-3.amazonaws.com',
      's3-website.dualstack.ap-northeast-3.amazonaws.com',
      's3.ap-northeast-3.amazonaws.com',
      's3-accesspoint.ap-northeast-3.amazonaws.com',
      's3-object-lambda.ap-northeast-3.amazonaws.com',
      's3-website.ap-northeast-3.amazonaws.com',
      's3.dualstack.ap-south-1.amazonaws.com',
      's3-accesspoint.dualstack.ap-south-1.amazonaws.com',
      's3-website.dualstack.ap-south-1.amazonaws.com',
      's3.ap-south-1.amazonaws.com',
      's3-accesspoint.ap-south-1.amazonaws.com',
      's3-object-lambda.ap-south-1.amazonaws.com',
      's3-website.ap-south-1.amazonaws.com',
      's3.dualstack.ap-south-2.amazonaws.com',
      's3-accesspoint.dualstack.ap-south-2.amazonaws.com',
      's3-website.dualstack.ap-south-2.amazonaws.com',
      's3.ap-south-2.amazonaws.com',
      's3-accesspoint.ap-south-2.amazonaws.com',
      's3-object-lambda.ap-south-2.amazonaws.com',
      's3-website.ap-south-2.amazonaws.com',
      's3.dualstack.ap-southeast-1.amazonaws.com',
      's3-accesspoint.dualstack.ap-southeast-1.amazonaws.com',
      's3-website.dualstack.ap-southeast-1.amazonaws.com',
      's3.ap-southeast-1.amazonaws.com',
      's3-accesspoint.ap-southeast-1.amazonaws.com',
      's3-object-lambda.ap-southeast-1.amazonaws.com',
      's3-website.ap-southeast-1.amazonaws.com',
      's3.dualstack.ap-southeast-2.amazonaws.com',
      's3-accesspoint.dualstack.ap-southeast-2.amazonaws.com',
      's3-website.dualstack.ap-southeast-2.amazonaws.com',
      's3.ap-southeast-2.amazonaws.com',
      's3-accesspoint.ap-southeast-2.amazonaws.com',
      's3-object-lambda.ap-southeast-2.amazonaws.com',
      's3-website.ap-southeast-2.amazonaws.com',
      's3.dualstack.ap-southeast-3.amazonaws.com',
      's3-accesspoint.dualstack.ap-southeast-3.amazonaws.com',
      's3-website.dualstack.ap-southeast-3.amazonaws.com',
      's3.ap-southeast-3.amazonaws.com',
      's3-accesspoint.ap-southeast-3.amazonaws.com',
      's3-object-lambda.ap-southeast-3.amazonaws.com',
      's3-website.ap-southeast-3.amazonaws.com',
      's3.dualstack.ap-southeast-4.amazonaws.com',
      's3-accesspoint.dualstack.ap-southeast-4.amazonaws.com',
      's3-website.dualstack.ap-southeast-4.amazonaws.com',
      's3.ap-southeast-4.amazonaws.com',
      's3-accesspoint.ap-southeast-4.amazonaws.com',
      's3-object-lambda.ap-southeast-4.amazonaws.com',
      's3-website.ap-southeast-4.amazonaws.com',
      's3.dualstack.ap-southeast-5.amazonaws.com',
      's3-accesspoint.dualstack.ap-southeast-5.amazonaws.com',
      's3-website.dualstack.ap-southeast-5.amazonaws.com',
      's3.ap-southeast-5.amazonaws.com',
      's3-accesspoint.ap-southeast-5.amazonaws.com',
      's3-deprecated.ap-southeast-5.amazonaws.com',
      's3-object-lambda.ap-southeast-5.amazonaws.com',
      's3-website.ap-southeast-5.amazonaws.com',
      's3.dualstack.ca-central-1.amazonaws.com',
      's3-accesspoint.dualstack.ca-central-1.amazonaws.com',
      's3-accesspoint-fips.dualstack.ca-central-1.amazonaws.com',
      's3-fips.dualstack.ca-central-1.amazonaws.com',
      's3-website.dualstack.ca-central-1.amazonaws.com',
      's3.ca-central-1.amazonaws.com',
      's3-accesspoint.ca-central-1.amazonaws.com',
      's3-accesspoint-fips.ca-central-1.amazonaws.com',
      's3-fips.ca-central-1.amazonaws.com',
      's3-object-lambda.ca-central-1.amazonaws.com',
      's3-website.ca-central-1.amazonaws.com',
      's3.dualstack.ca-west-1.amazonaws.com',
      's3-accesspoint.dualstack.ca-west-1.amazonaws.com',
      's3-accesspoint-fips.dualstack.ca-west-1.amazonaws.com',
      's3-fips.dualstack.ca-west-1.amazonaws.com',
      's3-website.dualstack.ca-west-1.amazonaws.com',
      's3.ca-west-1.amazonaws.com',
      's3-accesspoint.ca-west-1.amazonaws.com',
      's3-accesspoint-fips.ca-west-1.amazonaws.com',
      's3-fips.ca-west-1.amazonaws.com',
      's3-object-lambda.ca-west-1.amazonaws.com',
      's3-website.ca-west-1.amazonaws.com',
      's3.dualstack.eu-central-1.amazonaws.com',
      's3-accesspoint.dualstack.eu-central-1.amazonaws.com',
      's3-website.dualstack.eu-central-1.amazonaws.com',
      's3.eu-central-1.amazonaws.com',
      's3-accesspoint.eu-central-1.amazonaws.com',
      's3-object-lambda.eu-central-1.amazonaws.com',
      's3-website.eu-central-1.amazonaws.com',
      's3.dualstack.eu-central-2.amazonaws.com',
      's3-accesspoint.dualstack.eu-central-2.amazonaws.com',
      's3-website.dualstack.eu-central-2.amazonaws.com',
      's3.eu-central-2.amazonaws.com',
      's3-accesspoint.eu-central-2.amazonaws.com',
      's3-object-lambda.eu-central-2.amazonaws.com',
      's3-website.eu-central-2.amazonaws.com',
      's3.dualstack.eu-north-1.amazonaws.com',
      's3-accesspoint.dualstack.eu-north-1.amazonaws.com',
      's3.eu-north-1.amazonaws.com',
      's3-accesspoint.eu-north-1.amazonaws.com',
      's3-object-lambda.eu-north-1.amazonaws.com',
      's3-website.eu-north-1.amazonaws.com',
      's3.dualstack.eu-south-1.amazonaws.com',
      's3-accesspoint.dualstack.eu-south-1.amazonaws.com',
      's3-website.dualstack.eu-south-1.amazonaws.com',
      's3.eu-south-1.amazonaws.com',
      's3-accesspoint.eu-south-1.amazonaws.com',
      's3-object-lambda.eu-south-1.amazonaws.com',
      's3-website.eu-south-1.amazonaws.com',
      's3.dualstack.eu-south-2.amazonaws.com',
      's3-accesspoint.dualstack.eu-south-2.amazonaws.com',
      's3-website.dualstack.eu-south-2.amazonaws.com',
      's3.eu-south-2.amazonaws.com',
      's3-accesspoint.eu-south-2.amazonaws.com',
      's3-object-lambda.eu-south-2.amazonaws.com',
      's3-website.eu-south-2.amazonaws.com',
      's3.dualstack.eu-west-1.amazonaws.com',
      's3-accesspoint.dualstack.eu-west-1.amazonaws.com',
      's3-website.dualstack.eu-west-1.amazonaws.com',
      's3.eu-west-1.amazonaws.com',
      's3-accesspoint.eu-west-1.amazonaws.com',
      's3-deprecated.eu-west-1.amazonaws.com',
      's3-object-lambda.eu-west-1.amazonaws.com',
      's3-website.eu-west-1.amazonaws.com',
      's3.dualstack.eu-west-2.amazonaws.com',
      's3-accesspoint.dualstack.eu-west-2.amazonaws.com',
      's3.eu-west-2.amazonaws.com',
      's3-accesspoint.eu-west-2.amazonaws.com',
      's3-object-lambda.eu-west-2.amazonaws.com',
      's3-website.eu-west-2.amazonaws.com',
      's3.dualstack.eu-west-3.amazonaws.com',
      's3-accesspoint.dualstack.eu-west-3.amazonaws.com',
      's3-website.dualstack.eu-west-3.amazonaws.com',
      's3.eu-west-3.amazonaws.com',
      's3-accesspoint.eu-west-3.amazonaws.com',
      's3-object-lambda.eu-west-3.amazonaws.com',
      's3-website.eu-west-3.amazonaws.com',
      's3.dualstack.il-central-1.amazonaws.com',
      's3-accesspoint.dualstack.il-central-1.amazonaws.com',
      's3-website.dualstack.il-central-1.amazonaws.com',
      's3.il-central-1.amazonaws.com',
      's3-accesspoint.il-central-1.amazonaws.com',
      's3-object-lambda.il-central-1.amazonaws.com',
      's3-website.il-central-1.amazonaws.com',
      's3.dualstack.me-central-1.amazonaws.com',
      's3-accesspoint.dualstack.me-central-1.amazonaws.com',
      's3-website.dualstack.me-central-1.amazonaws.com',
      's3.me-central-1.amazonaws.com',
      's3-accesspoint.me-central-1.amazonaws.com',
      's3-object-lambda.me-central-1.amazonaws.com',
      's3-website.me-central-1.amazonaws.com',
      's3.dualstack.me-south-1.amazonaws.com',
      's3-accesspoint.dualstack.me-south-1.amazonaws.com',
      's3.me-south-1.amazonaws.com',
      's3-accesspoint.me-south-1.amazonaws.com',
      's3-object-lambda.me-south-1.amazonaws.com',
      's3-website.me-south-1.amazonaws.com',
      's3.amazonaws.com',
      's3-1.amazonaws.com',
      's3-ap-east-1.amazonaws.com',
      's3-ap-northeast-1.amazonaws.com',
      's3-ap-northeast-2.amazonaws.com',
      's3-ap-northeast-3.amazonaws.com',
      's3-ap-south-1.amazonaws.com',
      's3-ap-southeast-1.amazonaws.com',
      's3-ap-southeast-2.amazonaws.com',
      's3-ca-central-1.amazonaws.com',
      's3-eu-central-1.amazonaws.com',
      's3-eu-north-1.amazonaws.com',
      's3-eu-west-1.amazonaws.com',
      's3-eu-west-2.amazonaws.com',
      's3-eu-west-3.amazonaws.com',
      's3-external-1.amazonaws.com',
      's3-fips-us-gov-east-1.amazonaws.com',
      's3-fips-us-gov-west-1.amazonaws.com',
      'mrap.accesspoint.s3-global.amazonaws.com',
      's3-me-south-1.amazonaws.com',
      's3-sa-east-1.amazonaws.com',
      's3-us-east-2.amazonaws.com',
      's3-us-gov-east-1.amazonaws.com',
      's3-us-gov-west-1.amazonaws.com',
      's3-us-west-1.amazonaws.com',
      's3-us-west-2.amazonaws.com',
      's3-website-ap-northeast-1.amazonaws.com',
      's3-website-ap-southeast-1.amazonaws.com',
      's3-website-ap-southeast-2.amazonaws.com',
      's3-website-eu-west-1.amazonaws.com',
      's3-website-sa-east-1.amazonaws.com',
      's3-website-us-east-1.amazonaws.com',
      's3-website-us-gov-west-1.amazonaws.com',
      's3-website-us-west-1.amazonaws.com',
      's3-website-us-west-2.amazonaws.com',
      's3.dualstack.sa-east-1.amazonaws.com',
      's3-accesspoint.dualstack.sa-east-1.amazonaws.com',
      's3-website.dualstack.sa-east-1.amazonaws.com',
      's3.sa-east-1.amazonaws.com',
      's3-accesspoint.sa-east-1.amazonaws.com',
      's3-object-lambda.sa-east-1.amazonaws.com',
      's3-website.sa-east-1.amazonaws.com',
      's3.dualstack.us-east-1.amazonaws.com',
      's3-accesspoint.dualstack.us-east-1.amazonaws.com',
      's3-accesspoint-fips.dualstack.us-east-1.amazonaws.com',
      's3-fips.dualstack.us-east-1.amazonaws.com',
      's3-website.dualstack.us-east-1.amazonaws.com',
      's3.us-east-1.amazonaws.com',
      's3-accesspoint.us-east-1.amazonaws.com',
      's3-accesspoint-fips.us-east-1.amazonaws.com',
      's3-deprecated.us-east-1.amazonaws.com',
      's3-fips.us-east-1.amazonaws.com',
      's3-object-lambda.us-east-1.amazonaws.com',
      's3-website.us-east-1.amazonaws.com',
      's3.dualstack.us-east-2.amazonaws.com',
      's3-accesspoint.dualstack.us-east-2.amazonaws.com',
      's3-accesspoint-fips.dualstack.us-east-2.amazonaws.com',
      's3-fips.dualstack.us-east-2.amazonaws.com',
      's3-website.dualstack.us-east-2.amazonaws.com',
      's3.us-east-2.amazonaws.com',
      's3-accesspoint.us-east-2.amazonaws.com',
      's3-accesspoint-fips.us-east-2.amazonaws.com',
      's3-deprecated.us-east-2.amazonaws.com',
      's3-fips.us-east-2.amazonaws.com',
      's3-object-lambda.us-east-2.amazonaws.com',
      's3-website.us-east-2.amazonaws.com',
      's3.dualstack.us-gov-east-1.amazonaws.com',
      's3-accesspoint.dualstack.us-gov-east-1.amazonaws.com',
      's3-accesspoint-fips.dualstack.us-gov-east-1.amazonaws.com',
      's3-fips.dualstack.us-gov-east-1.amazonaws.com',
      's3.us-gov-east-1.amazonaws.com',
      's3-accesspoint.us-gov-east-1.amazonaws.com',
      's3-accesspoint-fips.us-gov-east-1.amazonaws.com',
      's3-fips.us-gov-east-1.amazonaws.com',
      's3-object-lambda.us-gov-east-1.amazonaws.com',
      's3-website.us-gov-east-1.amazonaws.com',
      's3.dualstack.us-gov-west-1.amazonaws.com',
      's3-accesspoint.dualstack.us-gov-west-1.amazonaws.com',
      's3-accesspoint-fips.dualstack.us-gov-west-1.amazonaws.com',
      's3-fips.dualstack.us-gov-west-1.amazonaws.com',
      's3.us-gov-west-1.amazonaws.com',
      's3-accesspoint.us-gov-west-1.amazonaws.com',
      's3-accesspoint-fips.us-gov-west-1.amazonaws.com',
      's3-fips.us-gov-west-1.amazonaws.com',
      's3-object-lambda.us-gov-west-1.amazonaws.com',
      's3-website.us-gov-west-1.amazonaws.com',
      's3.dualstack.us-west-1.amazonaws.com',
      's3-accesspoint.dualstack.us-west-1.amazonaws.com',
      's3-accesspoint-fips.dualstack.us-west-1.amazonaws.com',
      's3-fips.dualstack.us-west-1.amazonaws.com',
      's3-website.dualstack.us-west-1.amazonaws.com',
      's3.us-west-1.amazonaws.com',
      's3-accesspoint.us-west-1.amazonaws.com',
      's3-accesspoint-fips.us-west-1.amazonaws.com',
      's3-fips.us-west-1.amazonaws.com',
      's3-object-lambda.us-west-1.amazonaws.com',
      's3-website.us-west-1.amazonaws.com',
      's3.dualstack.us-west-2.amazonaws.com',
      's3-accesspoint.dualstack.us-west-2.amazonaws.com',
      's3-accesspoint-fips.dualstack.us-west-2.amazonaws.com',
      's3-fips.dualstack.us-west-2.amazonaws.com',
      's3-website.dualstack.us-west-2.amazonaws.com',
      's3.us-west-2.amazonaws.com',
      's3-accesspoint.us-west-2.amazonaws.com',
      's3-accesspoint-fips.us-west-2.amazonaws.com',
      's3-deprecated.us-west-2.amazonaws.com',
      's3-fips.us-west-2.amazonaws.com',
      's3-object-lambda.us-west-2.amazonaws.com',
      's3-website.us-west-2.amazonaws.com',
      'labeling.ap-northeast-1.sagemaker.aws',
      'labeling.ap-northeast-2.sagemaker.aws',
      'labeling.ap-south-1.sagemaker.aws',
      'labeling.ap-southeast-1.sagemaker.aws',
      'labeling.ap-southeast-2.sagemaker.aws',
      'labeling.ca-central-1.sagemaker.aws',
      'labeling.eu-central-1.sagemaker.aws',
      'labeling.eu-west-1.sagemaker.aws',
      'labeling.eu-west-2.sagemaker.aws',
      'labeling.us-east-1.sagemaker.aws',
      'labeling.us-east-2.sagemaker.aws',
      'labeling.us-west-2.sagemaker.aws',
      'notebook.af-south-1.sagemaker.aws',
      'notebook.ap-east-1.sagemaker.aws',
      'notebook.ap-northeast-1.sagemaker.aws',
      'notebook.ap-northeast-2.sagemaker.aws',
      'notebook.ap-northeast-3.sagemaker.aws',
      'notebook.ap-south-1.sagemaker.aws',
      'notebook.ap-south-2.sagemaker.aws',
      'notebook.ap-southeast-1.sagemaker.aws',
      'notebook.ap-southeast-2.sagemaker.aws',
      'notebook.ap-southeast-3.sagemaker.aws',
      'notebook.ap-southeast-4.sagemaker.aws',
      'notebook.ca-central-1.sagemaker.aws',
      'notebook-fips.ca-central-1.sagemaker.aws',
      'notebook.ca-west-1.sagemaker.aws',
      'notebook-fips.ca-west-1.sagemaker.aws',
      'notebook.eu-central-1.sagemaker.aws',
      'notebook.eu-central-2.sagemaker.aws',
      'notebook.eu-north-1.sagemaker.aws',
      'notebook.eu-south-1.sagemaker.aws',
      'notebook.eu-south-2.sagemaker.aws',
      'notebook.eu-west-1.sagemaker.aws',
      'notebook.eu-west-2.sagemaker.aws',
      'notebook.eu-west-3.sagemaker.aws',
      'notebook.il-central-1.sagemaker.aws',
      'notebook.me-central-1.sagemaker.aws',
      'notebook.me-south-1.sagemaker.aws',
      'notebook.sa-east-1.sagemaker.aws',
      'notebook.us-east-1.sagemaker.aws',
      'notebook-fips.us-east-1.sagemaker.aws',
      'notebook.us-east-2.sagemaker.aws',
      'notebook-fips.us-east-2.sagemaker.aws',
      'notebook.us-gov-east-1.sagemaker.aws',
      'notebook-fips.us-gov-east-1.sagemaker.aws',
      'notebook.us-gov-west-1.sagemaker.aws',
      'notebook-fips.us-gov-west-1.sagemaker.aws',
      'notebook.us-west-1.sagemaker.aws',
      'notebook-fips.us-west-1.sagemaker.aws',
      'notebook.us-west-2.sagemaker.aws',
      'notebook-fips.us-west-2.sagemaker.aws',
      'notebook.cn-north-1.sagemaker.com.cn',
      'notebook.cn-northwest-1.sagemaker.com.cn',
      'studio.af-south-1.sagemaker.aws',
      'studio.ap-east-1.sagemaker.aws',
      'studio.ap-northeast-1.sagemaker.aws',
      'studio.ap-northeast-2.sagemaker.aws',
      'studio.ap-northeast-3.sagemaker.aws',
      'studio.ap-south-1.sagemaker.aws',
      'studio.ap-southeast-1.sagemaker.aws',
      'studio.ap-southeast-2.sagemaker.aws',
      'studio.ap-southeast-3.sagemaker.aws',
      'studio.ca-central-1.sagemaker.aws',
      'studio.eu-central-1.sagemaker.aws',
      'studio.eu-north-1.sagemaker.aws',
      'studio.eu-south-1.sagemaker.aws',
      'studio.eu-south-2.sagemaker.aws',
      'studio.eu-west-1.sagemaker.aws',
      'studio.eu-west-2.sagemaker.aws',
      'studio.eu-west-3.sagemaker.aws',
      'studio.il-central-1.sagemaker.aws',
      'studio.me-central-1.sagemaker.aws',
      'studio.me-south-1.sagemaker.aws',
      'studio.sa-east-1.sagemaker.aws',
      'studio.us-east-1.sagemaker.aws',
      'studio.us-east-2.sagemaker.aws',
      'studio.us-gov-east-1.sagemaker.aws',
      'studio-fips.us-gov-east-1.sagemaker.aws',
      'studio.us-gov-west-1.sagemaker.aws',
      'studio-fips.us-gov-west-1.sagemaker.aws',
      'studio.us-west-1.sagemaker.aws',
      'studio.us-west-2.sagemaker.aws',
      'studio.cn-north-1.sagemaker.com.cn',
      'studio.cn-northwest-1.sagemaker.com.cn',
      '*.experiments.sagemaker.aws',
      'analytics-gateway.ap-northeast-1.amazonaws.com',
      'analytics-gateway.ap-northeast-2.amazonaws.com',
      'analytics-gateway.ap-south-1.amazonaws.com',
      'analytics-gateway.ap-southeast-1.amazonaws.com',
      'analytics-gateway.ap-southeast-2.amazonaws.com',
      'analytics-gateway.eu-central-1.amazonaws.com',
      'analytics-gateway.eu-west-1.amazonaws.com',
      'analytics-gateway.us-east-1.amazonaws.com',
      'analytics-gateway.us-east-2.amazonaws.com',
      'analytics-gateway.us-west-2.amazonaws.com',
      'amplifyapp.com',
      '*.awsapprunner.com',
      'webview-assets.aws-cloud9.af-south-1.amazonaws.com',
      'vfs.cloud9.af-south-1.amazonaws.com',
      'webview-assets.cloud9.af-south-1.amazonaws.com',
      'webview-assets.aws-cloud9.ap-east-1.amazonaws.com',
      'vfs.cloud9.ap-east-1.amazonaws.com',
      'webview-assets.cloud9.ap-east-1.amazonaws.com',
      'webview-assets.aws-cloud9.ap-northeast-1.amazonaws.com',
      'vfs.cloud9.ap-northeast-1.amazonaws.com',
      'webview-assets.cloud9.ap-northeast-1.amazonaws.com',
      'webview-assets.aws-cloud9.ap-northeast-2.amazonaws.com',
      'vfs.cloud9.ap-northeast-2.amazonaws.com',
      'webview-assets.cloud9.ap-northeast-2.amazonaws.com',
      'webview-assets.aws-cloud9.ap-northeast-3.amazonaws.com',
      'vfs.cloud9.ap-northeast-3.amazonaws.com',
      'webview-assets.cloud9.ap-northeast-3.amazonaws.com',
      'webview-assets.aws-cloud9.ap-south-1.amazonaws.com',
      'vfs.cloud9.ap-south-1.amazonaws.com',
      'webview-assets.cloud9.ap-south-1.amazonaws.com',
      'webview-assets.aws-cloud9.ap-southeast-1.amazonaws.com',
      'vfs.cloud9.ap-southeast-1.amazonaws.com',
      'webview-assets.cloud9.ap-southeast-1.amazonaws.com',
      'webview-assets.aws-cloud9.ap-southeast-2.amazonaws.com',
      'vfs.cloud9.ap-southeast-2.amazonaws.com',
      'webview-assets.cloud9.ap-southeast-2.amazonaws.com',
      'webview-assets.aws-cloud9.ca-central-1.amazonaws.com',
      'vfs.cloud9.ca-central-1.amazonaws.com',
      'webview-assets.cloud9.ca-central-1.amazonaws.com',
      'webview-assets.aws-cloud9.eu-central-1.amazonaws.com',
      'vfs.cloud9.eu-central-1.amazonaws.com',
      'webview-assets.cloud9.eu-central-1.amazonaws.com',
      'webview-assets.aws-cloud9.eu-north-1.amazonaws.com',
      'vfs.cloud9.eu-north-1.amazonaws.com',
      'webview-assets.cloud9.eu-north-1.amazonaws.com',
      'webview-assets.aws-cloud9.eu-south-1.amazonaws.com',
      'vfs.cloud9.eu-south-1.amazonaws.com',
      'webview-assets.cloud9.eu-south-1.amazonaws.com',
      'webview-assets.aws-cloud9.eu-west-1.amazonaws.com',
      'vfs.cloud9.eu-west-1.amazonaws.com',
      'webview-assets.cloud9.eu-west-1.amazonaws.com',
      'webview-assets.aws-cloud9.eu-west-2.amazonaws.com',
      'vfs.cloud9.eu-west-2.amazonaws.com',
      'webview-assets.cloud9.eu-west-2.amazonaws.com',
      'webview-assets.aws-cloud9.eu-west-3.amazonaws.com',
      'vfs.cloud9.eu-west-3.amazonaws.com',
      'webview-assets.cloud9.eu-west-3.amazonaws.com',
      'webview-assets.aws-cloud9.il-central-1.amazonaws.com',
      'vfs.cloud9.il-central-1.amazonaws.com',
      'webview-assets.aws-cloud9.me-south-1.amazonaws.com',
      'vfs.cloud9.me-south-1.amazonaws.com',
      'webview-assets.cloud9.me-south-1.amazonaws.com',
      'webview-assets.aws-cloud9.sa-east-1.amazonaws.com',
      'vfs.cloud9.sa-east-1.amazonaws.com',
      'webview-assets.cloud9.sa-east-1.amazonaws.com',
      'webview-assets.aws-cloud9.us-east-1.amazonaws.com',
      'vfs.cloud9.us-east-1.amazonaws.com',
      'webview-assets.cloud9.us-east-1.amazonaws.com',
      'webview-assets.aws-cloud9.us-east-2.amazonaws.com',
      'vfs.cloud9.us-east-2.amazonaws.com',
      'webview-assets.cloud9.us-east-2.amazonaws.com',
      'webview-assets.aws-cloud9.us-west-1.amazonaws.com',
      'vfs.cloud9.us-west-1.amazonaws.com',
      'webview-assets.cloud9.us-west-1.amazonaws.com',
      'webview-assets.aws-cloud9.us-west-2.amazonaws.com',
      'vfs.cloud9.us-west-2.amazonaws.com',
      'webview-assets.cloud9.us-west-2.amazonaws.com',
      'awsapps.com',
      'cn-north-1.eb.amazonaws.com.cn',
      'cn-northwest-1.eb.amazonaws.com.cn',
      'elasticbeanstalk.com',
      'af-south-1.elasticbeanstalk.com',
      'ap-east-1.elasticbeanstalk.com',
      'ap-northeast-1.elasticbeanstalk.com',
      'ap-northeast-2.elasticbeanstalk.com',
      'ap-northeast-3.elasticbeanstalk.com',
      'ap-south-1.elasticbeanstalk.com',
      'ap-southeast-1.elasticbeanstalk.com',
      'ap-southeast-2.elasticbeanstalk.com',
      'ap-southeast-3.elasticbeanstalk.com',
      'ca-central-1.elasticbeanstalk.com',
      'eu-central-1.elasticbeanstalk.com',
      'eu-north-1.elasticbeanstalk.com',
      'eu-south-1.elasticbeanstalk.com',
      'eu-west-1.elasticbeanstalk.com',
      'eu-west-2.elasticbeanstalk.com',
      'eu-west-3.elasticbeanstalk.com',
      'il-central-1.elasticbeanstalk.com',
      'me-south-1.elasticbeanstalk.com',
      'sa-east-1.elasticbeanstalk.com',
      'us-east-1.elasticbeanstalk.com',
      'us-east-2.elasticbeanstalk.com',
      'us-gov-east-1.elasticbeanstalk.com',
      'us-gov-west-1.elasticbeanstalk.com',
      'us-west-1.elasticbeanstalk.com',
      'us-west-2.elasticbeanstalk.com',
      '*.elb.amazonaws.com.cn',
      '*.elb.amazonaws.com',
      'awsglobalaccelerator.com',
      '*.private.repost.aws',
      'eero.online',
      'eero-stage.online',
      'apigee.io',
      'panel.dev',
      'siiites.com',
      'appspacehosted.com',
      'appspaceusercontent.com',
      'appudo.net',
      'on-aptible.com',
      'f5.si',
      'arvanedge.ir',
      'user.aseinet.ne.jp',
      'gv.vc',
      'd.gv.vc',
      'user.party.eus',
      'pimienta.org',
      'poivron.org',
      'potager.org',
      'sweetpepper.org',
      'myasustor.com',
      'cdn.prod.atlassian-dev.net',
      'translated.page',
      'myfritz.link',
      'myfritz.net',
      'onavstack.net',
      '*.awdev.ca',
      '*.advisor.ws',
      'ecommerce-shop.pl',
      'b-data.io',
      'balena-devices.com',
      'base.ec',
      'official.ec',
      'buyshop.jp',
      'fashionstore.jp',
      'handcrafted.jp',
      'kawaiishop.jp',
      'supersale.jp',
      'theshop.jp',
      'shopselect.net',
      'base.shop',
      'beagleboard.io',
      '*.beget.app',
      'pages.gay',
      'bnr.la',
      'bitbucket.io',
      'blackbaudcdn.net',
      'of.je',
      'bluebite.io',
      'boomla.net',
      'boutir.com',
      'boxfuse.io',
      'square7.ch',
      'bplaced.com',
      'bplaced.de',
      'square7.de',
      'bplaced.net',
      'square7.net',
      '*.s.brave.io',
      'shop.brendly.hr',
      'shop.brendly.rs',
      'browsersafetymark.io',
      'radio.am',
      'radio.fm',
      'uk0.bigv.io',
      'dh.bytemark.co.uk',
      'vm.bytemark.co.uk',
      'cafjs.com',
      'canva-apps.cn',
      '*.my.canvasite.cn',
      'canva-apps.com',
      '*.my.canva.site',
      'drr.ac',
      'uwu.ai',
      'carrd.co',
      'crd.co',
      'ju.mp',
      'api.gov.uk',
      'cdn77-storage.com',
      'rsc.contentproxy9.cz',
      'r.cdn77.net',
      'cdn77-ssl.net',
      'c.cdn77.org',
      'rsc.cdn77.org',
      'ssl.origin.cdn77-secure.org',
      'za.bz',
      'br.com',
      'cn.com',
      'de.com',
      'eu.com',
      'jpn.com',
      'mex.com',
      'ru.com',
      'sa.com',
      'uk.com',
      'us.com',
      'za.com',
      'com.de',
      'gb.net',
      'hu.net',
      'jp.net',
      'se.net',
      'uk.net',
      'ae.org',
      'com.se',
      'cx.ua',
      'discourse.group',
      'discourse.team',
      'clerk.app',
      'clerkstage.app',
      '*.lcl.dev',
      '*.lclstage.dev',
      '*.stg.dev',
      '*.stgstage.dev',
      'cleverapps.cc',
      '*.services.clever-cloud.com',
      'cleverapps.io',
      'cleverapps.tech',
      'clickrising.net',
      'cloudns.asia',
      'cloudns.be',
      'cloud-ip.biz',
      'cloudns.biz',
      'cloudns.cc',
      'cloudns.ch',
      'cloudns.cl',
      'cloudns.club',
      'dnsabr.com',
      'ip-ddns.com',
      'cloudns.cx',
      'cloudns.eu',
      'cloudns.in',
      'cloudns.info',
      'ddns-ip.net',
      'dns-cloud.net',
      'dns-dynamic.net',
      'cloudns.nz',
      'cloudns.org',
      'ip-dynamic.org',
      'cloudns.ph',
      'cloudns.pro',
      'cloudns.pw',
      'cloudns.us',
      'c66.me',
      'cloud66.ws',
      'cloud66.zone',
      'jdevcloud.com',
      'wpdevcloud.com',
      'cloudaccess.host',
      'freesite.host',
      'cloudaccess.net',
      '*.cloudera.site',
      'cf-ipfs.com',
      'cloudflare-ipfs.com',
      'trycloudflare.com',
      'pages.dev',
      'r2.dev',
      'workers.dev',
      'cloudflare.net',
      'cdn.cloudflare.net',
      'cdn.cloudflareanycast.net',
      'cdn.cloudflarecn.net',
      'cdn.cloudflareglobal.net',
      'cust.cloudscale.ch',
      'objects.lpg.cloudscale.ch',
      'objects.rma.cloudscale.ch',
      'wnext.app',
      'cnpy.gdn',
      '*.otap.co',
      'co.ca',
      'co.com',
      'codeberg.page',
      'csb.app',
      'preview.csb.app',
      'co.nl',
      'co.no',
      'webhosting.be',
      'hosting-cluster.nl',
      'ctfcloud.net',
      'convex.site',
      'ac.ru',
      'edu.ru',
      'gov.ru',
      'int.ru',
      'mil.ru',
      'test.ru',
      'dyn.cosidns.de',
      'dnsupdater.de',
      'dynamisches-dns.de',
      'internet-dns.de',
      'l-o-g-i-n.de',
      'dynamic-dns.info',
      'feste-ip.net',
      'knx-server.net',
      'static-access.net',
      'craft.me',
      'realm.cz',
      'on.crisp.email',
      '*.cryptonomic.net',
      'curv.dev',
      'cfolks.pl',
      'cyon.link',
      'cyon.site',
      'platform0.app',
      'fnwk.site',
      'folionetwork.site',
      'biz.dk',
      'co.dk',
      'firm.dk',
      'reg.dk',
      'store.dk',
      'dyndns.dappnode.io',
      'builtwithdark.com',
      'darklang.io',
      'demo.datadetect.com',
      'instance.datadetect.com',
      'edgestack.me',
      'dattolocal.com',
      'dattorelay.com',
      'dattoweb.com',
      'mydatto.com',
      'dattolocal.net',
      'mydatto.net',
      'ddnss.de',
      'dyn.ddnss.de',
      'dyndns.ddnss.de',
      'dyn-ip24.de',
      'dyndns1.de',
      'home-webserver.de',
      'dyn.home-webserver.de',
      'myhome-server.de',
      'ddnss.org',
      'debian.net',
      'definima.io',
      'definima.net',
      'deno.dev',
      'deno-staging.dev',
      'dedyn.io',
      'deta.app',
      'deta.dev',
      'dfirma.pl',
      'dkonto.pl',
      'you2.pl',
      'ondigitalocean.app',
      '*.digitaloceanspaces.com',
      'us.kg',
      'rss.my.id',
      'diher.solutions',
      'discordsays.com',
      'discordsez.com',
      'jozi.biz',
      'dnshome.de',
      'online.th',
      'shop.th',
      'drayddns.com',
      'shoparena.pl',
      'dreamhosters.com',
      'durumis.com',
      'mydrobo.com',
      'drud.io',
      'drud.us',
      'duckdns.org',
      'dy.fi',
      'tunk.org',
      'dyndns.biz',
      'for-better.biz',
      'for-more.biz',
      'for-some.biz',
      'for-the.biz',
      'selfip.biz',
      'webhop.biz',
      'ftpaccess.cc',
      'game-server.cc',
      'myphotos.cc',
      'scrapping.cc',
      'blogdns.com',
      'cechire.com',
      'dnsalias.com',
      'dnsdojo.com',
      'doesntexist.com',
      'dontexist.com',
      'doomdns.com',
      'dyn-o-saur.com',
      'dynalias.com',
      'dyndns-at-home.com',
      'dyndns-at-work.com',
      'dyndns-blog.com',
      'dyndns-free.com',
      'dyndns-home.com',
      'dyndns-ip.com',
      'dyndns-mail.com',
      'dyndns-office.com',
      'dyndns-pics.com',
      'dyndns-remote.com',
      'dyndns-server.com',
      'dyndns-web.com',
      'dyndns-wiki.com',
      'dyndns-work.com',
      'est-a-la-maison.com',
      'est-a-la-masion.com',
      'est-le-patron.com',
      'est-mon-blogueur.com',
      'from-ak.com',
      'from-al.com',
      'from-ar.com',
      'from-ca.com',
      'from-ct.com',
      'from-dc.com',
      'from-de.com',
      'from-fl.com',
      'from-ga.com',
      'from-hi.com',
      'from-ia.com',
      'from-id.com',
      'from-il.com',
      'from-in.com',
      'from-ks.com',
      'from-ky.com',
      'from-ma.com',
      'from-md.com',
      'from-mi.com',
      'from-mn.com',
      'from-mo.com',
      'from-ms.com',
      'from-mt.com',
      'from-nc.com',
      'from-nd.com',
      'from-ne.com',
      'from-nh.com',
      'from-nj.com',
      'from-nm.com',
      'from-nv.com',
      'from-oh.com',
      'from-ok.com',
      'from-or.com',
      'from-pa.com',
      'from-pr.com',
      'from-ri.com',
      'from-sc.com',
      'from-sd.com',
      'from-tn.com',
      'from-tx.com',
      'from-ut.com',
      'from-va.com',
      'from-vt.com',
      'from-wa.com',
      'from-wi.com',
      'from-wv.com',
      'from-wy.com',
      'getmyip.com',
      'gotdns.com',
      'hobby-site.com',
      'homelinux.com',
      'homeunix.com',
      'iamallama.com',
      'is-a-anarchist.com',
      'is-a-blogger.com',
      'is-a-bookkeeper.com',
      'is-a-bulls-fan.com',
      'is-a-caterer.com',
      'is-a-chef.com',
      'is-a-conservative.com',
      'is-a-cpa.com',
      'is-a-cubicle-slave.com',
      'is-a-democrat.com',
      'is-a-designer.com',
      'is-a-doctor.com',
      'is-a-financialadvisor.com',
      'is-a-geek.com',
      'is-a-green.com',
      'is-a-guru.com',
      'is-a-hard-worker.com',
      'is-a-hunter.com',
      'is-a-landscaper.com',
      'is-a-lawyer.com',
      'is-a-liberal.com',
      'is-a-libertarian.com',
      'is-a-llama.com',
      'is-a-musician.com',
      'is-a-nascarfan.com',
      'is-a-nurse.com',
      'is-a-painter.com',
      'is-a-personaltrainer.com',
      'is-a-photographer.com',
      'is-a-player.com',
      'is-a-republican.com',
      'is-a-rockstar.com',
      'is-a-socialist.com',
      'is-a-student.com',
      'is-a-teacher.com',
      'is-a-techie.com',
      'is-a-therapist.com',
      'is-an-accountant.com',
      'is-an-actor.com',
      'is-an-actress.com',
      'is-an-anarchist.com',
      'is-an-artist.com',
      'is-an-engineer.com',
      'is-an-entertainer.com',
      'is-certified.com',
      'is-gone.com',
      'is-into-anime.com',
      'is-into-cars.com',
      'is-into-cartoons.com',
      'is-into-games.com',
      'is-leet.com',
      'is-not-certified.com',
      'is-slick.com',
      'is-uberleet.com',
      'is-with-theband.com',
      'isa-geek.com',
      'isa-hockeynut.com',
      'issmarterthanyou.com',
      'likes-pie.com',
      'likescandy.com',
      'neat-url.com',
      'saves-the-whales.com',
      'selfip.com',
      'sells-for-less.com',
      'sells-for-u.com',
      'servebbs.com',
      'simple-url.com',
      'space-to-rent.com',
      'teaches-yoga.com',
      'writesthisblog.com',
      'ath.cx',
      'fuettertdasnetz.de',
      'isteingeek.de',
      'istmein.de',
      'lebtimnetz.de',
      'leitungsen.de',
      'traeumtgerade.de',
      'barrel-of-knowledge.info',
      'barrell-of-knowledge.info',
      'dyndns.info',
      'for-our.info',
      'groks-the.info',
      'groks-this.info',
      'here-for-more.info',
      'knowsitall.info',
      'selfip.info',
      'webhop.info',
      'forgot.her.name',
      'forgot.his.name',
      'at-band-camp.net',
      'blogdns.net',
      'broke-it.net',
      'buyshouses.net',
      'dnsalias.net',
      'dnsdojo.net',
      'does-it.net',
      'dontexist.net',
      'dynalias.net',
      'dynathome.net',
      'endofinternet.net',
      'from-az.net',
      'from-co.net',
      'from-la.net',
      'from-ny.net',
      'gets-it.net',
      'ham-radio-op.net',
      'homeftp.net',
      'homeip.net',
      'homelinux.net',
      'homeunix.net',
      'in-the-band.net',
      'is-a-chef.net',
      'is-a-geek.net',
      'isa-geek.net',
      'kicks-ass.net',
      'office-on-the.net',
      'podzone.net',
      'scrapper-site.net',
      'selfip.net',
      'sells-it.net',
      'servebbs.net',
      'serveftp.net',
      'thruhere.net',
      'webhop.net',
      'merseine.nu',
      'mine.nu',
      'shacknet.nu',
      'blogdns.org',
      'blogsite.org',
      'boldlygoingnowhere.org',
      'dnsalias.org',
      'dnsdojo.org',
      'doesntexist.org',
      'dontexist.org',
      'doomdns.org',
      'dvrdns.org',
      'dynalias.org',
      'dyndns.org',
      'go.dyndns.org',
      'home.dyndns.org',
      'endofinternet.org',
      'endoftheinternet.org',
      'from-me.org',
      'game-host.org',
      'gotdns.org',
      'hobby-site.org',
      'homedns.org',
      'homeftp.org',
      'homelinux.org',
      'homeunix.org',
      'is-a-bruinsfan.org',
      'is-a-candidate.org',
      'is-a-celticsfan.org',
      'is-a-chef.org',
      'is-a-geek.org',
      'is-a-knight.org',
      'is-a-linux-user.org',
      'is-a-patsfan.org',
      'is-a-soxfan.org',
      'is-found.org',
      'is-lost.org',
      'is-saved.org',
      'is-very-bad.org',
      'is-very-evil.org',
      'is-very-good.org',
      'is-very-nice.org',
      'is-very-sweet.org',
      'isa-geek.org',
      'kicks-ass.org',
      'misconfused.org',
      'podzone.org',
      'readmyblog.org',
      'selfip.org',
      'sellsyourhome.org',
      'servebbs.org',
      'serveftp.org',
      'servegame.org',
      'stuff-4-sale.org',
      'webhop.org',
      'better-than.tv',
      'dyndns.tv',
      'on-the-web.tv',
      'worse-than.tv',
      'is-by.us',
      'land-4-sale.us',
      'stuff-4-sale.us',
      'dyndns.ws',
      'mypets.ws',
      'ddnsfree.com',
      'ddnsgeek.com',
      'giize.com',
      'gleeze.com',
      'kozow.com',
      'loseyourip.com',
      'ooguy.com',
      'theworkpc.com',
      'casacam.net',
      'dynu.net',
      'accesscam.org',
      'camdvr.org',
      'freeddns.org',
      'mywire.org',
      'webredirect.org',
      'myddns.rocks',
      'dynv6.net',
      'e4.cz',
      'easypanel.app',
      'easypanel.host',
      '*.ewp.live',
      'twmail.cc',
      'twmail.net',
      'twmail.org',
      'mymailer.com.tw',
      'url.tw',
      'at.emf.camp',
      'rt.ht',
      'elementor.cloud',
      'elementor.cool',
      'en-root.fr',
      'mytuleap.com',
      'tuleap-partners.com',
      'encr.app',
      'encoreapi.com',
      'eu.encoway.cloud',
      'eu.org',
      'al.eu.org',
      'asso.eu.org',
      'at.eu.org',
      'au.eu.org',
      'be.eu.org',
      'bg.eu.org',
      'ca.eu.org',
      'cd.eu.org',
      'ch.eu.org',
      'cn.eu.org',
      'cy.eu.org',
      'cz.eu.org',
      'de.eu.org',
      'dk.eu.org',
      'edu.eu.org',
      'ee.eu.org',
      'es.eu.org',
      'fi.eu.org',
      'fr.eu.org',
      'gr.eu.org',
      'hr.eu.org',
      'hu.eu.org',
      'ie.eu.org',
      'il.eu.org',
      'in.eu.org',
      'int.eu.org',
      'is.eu.org',
      'it.eu.org',
      'jp.eu.org',
      'kr.eu.org',
      'lt.eu.org',
      'lu.eu.org',
      'lv.eu.org',
      'me.eu.org',
      'mk.eu.org',
      'mt.eu.org',
      'my.eu.org',
      'net.eu.org',
      'ng.eu.org',
      'nl.eu.org',
      'no.eu.org',
      'nz.eu.org',
      'pl.eu.org',
      'pt.eu.org',
      'ro.eu.org',
      'ru.eu.org',
      'se.eu.org',
      'si.eu.org',
      'sk.eu.org',
      'tr.eu.org',
      'uk.eu.org',
      'us.eu.org',
      'eurodir.ru',
      'eu-1.evennode.com',
      'eu-2.evennode.com',
      'eu-3.evennode.com',
      'eu-4.evennode.com',
      'us-1.evennode.com',
      'us-2.evennode.com',
      'us-3.evennode.com',
      'us-4.evennode.com',
      'relay.evervault.app',
      'relay.evervault.dev',
      'expo.app',
      'staging.expo.app',
      'onfabrica.com',
      'ru.net',
      'adygeya.ru',
      'bashkiria.ru',
      'bir.ru',
      'cbg.ru',
      'com.ru',
      'dagestan.ru',
      'grozny.ru',
      'kalmykia.ru',
      'kustanai.ru',
      'marine.ru',
      'mordovia.ru',
      'msk.ru',
      'mytis.ru',
      'nalchik.ru',
      'nov.ru',
      'pyatigorsk.ru',
      'spb.ru',
      'vladikavkaz.ru',
      'vladimir.ru',
      'abkhazia.su',
      'adygeya.su',
      'aktyubinsk.su',
      'arkhangelsk.su',
      'armenia.su',
      'ashgabad.su',
      'azerbaijan.su',
      'balashov.su',
      'bashkiria.su',
      'bryansk.su',
      'bukhara.su',
      'chimkent.su',
      'dagestan.su',
      'east-kazakhstan.su',
      'exnet.su',
      'georgia.su',
      'grozny.su',
      'ivanovo.su',
      'jambyl.su',
      'kalmykia.su',
      'kaluga.su',
      'karacol.su',
      'karaganda.su',
      'karelia.su',
      'khakassia.su',
      'krasnodar.su',
      'kurgan.su',
      'kustanai.su',
      'lenug.su',
      'mangyshlak.su',
      'mordovia.su',
      'msk.su',
      'murmansk.su',
      'nalchik.su',
      'navoi.su',
      'north-kazakhstan.su',
      'nov.su',
      'obninsk.su',
      'penza.su',
      'pokrovsk.su',
      'sochi.su',
      'spb.su',
      'tashkent.su',
      'termez.su',
      'togliatti.su',
      'troitsk.su',
      'tselinograd.su',
      'tula.su',
      'tuva.su',
      'vladikavkaz.su',
      'vladimir.su',
      'vologda.su',
      'channelsdvr.net',
      'u.channelsdvr.net',
      'edgecompute.app',
      'fastly-edge.com',
      'fastly-terrarium.com',
      'freetls.fastly.net',
      'map.fastly.net',
      'a.prod.fastly.net',
      'global.prod.fastly.net',
      'a.ssl.fastly.net',
      'b.ssl.fastly.net',
      'global.ssl.fastly.net',
      'fastlylb.net',
      'map.fastlylb.net',
      '*.user.fm',
      'fastvps-server.com',
      'fastvps.host',
      'myfast.host',
      'fastvps.site',
      'myfast.space',
      'conn.uk',
      'copro.uk',
      'hosp.uk',
      'fedorainfracloud.org',
      'fedorapeople.org',
      'cloud.fedoraproject.org',
      'app.os.fedoraproject.org',
      'app.os.stg.fedoraproject.org',
      'mydobiss.com',
      'fh-muenster.io',
      'filegear.me',
      'firebaseapp.com',
      'fldrv.com',
      'flutterflow.app',
      'fly.dev',
      'shw.io',
      'edgeapp.net',
      'forgeblocks.com',
      'id.forgerock.io',
      'framer.ai',
      'framer.app',
      'framercanvas.com',
      'framer.media',
      'framer.photos',
      'framer.website',
      'framer.wiki',
      '0e.vc',
      'freebox-os.com',
      'freeboxos.com',
      'fbx-os.fr',
      'fbxos.fr',
      'freebox-os.fr',
      'freeboxos.fr',
      'freedesktop.org',
      'freemyip.com',
      '*.frusky.de',
      'wien.funkfeuer.at',
      'daemon.asia',
      'dix.asia',
      'mydns.bz',
      '0am.jp',
      '0g0.jp',
      '0j0.jp',
      '0t0.jp',
      'mydns.jp',
      'pgw.jp',
      'wjg.jp',
      'keyword-on.net',
      'live-on.net',
      'server-on.net',
      'mydns.tw',
      'mydns.vc',
      '*.futurecms.at',
      '*.ex.futurecms.at',
      '*.in.futurecms.at',
      'futurehosting.at',
      'futuremailing.at',
      '*.ex.ortsinfo.at',
      '*.kunden.ortsinfo.at',
      '*.statics.cloud',
      'aliases121.com',
      'campaign.gov.uk',
      'service.gov.uk',
      'independent-commission.uk',
      'independent-inquest.uk',
      'independent-inquiry.uk',
      'independent-panel.uk',
      'independent-review.uk',
      'public-inquiry.uk',
      'royal-commission.uk',
      'gehirn.ne.jp',
      'usercontent.jp',
      'gentapps.com',
      'gentlentapis.com',
      'lab.ms',
      'cdn-edges.net',
      'localcert.net',
      'localhostcert.net',
      'gsj.bz',
      'githubusercontent.com',
      'githubpreview.dev',
      'github.io',
      'gitlab.io',
      'gitapp.si',
      'gitpage.si',
      'glitch.me',
      'nog.community',
      'co.ro',
      'shop.ro',
      'lolipop.io',
      'angry.jp',
      'babyblue.jp',
      'babymilk.jp',
      'backdrop.jp',
      'bambina.jp',
      'bitter.jp',
      'blush.jp',
      'boo.jp',
      'boy.jp',
      'boyfriend.jp',
      'but.jp',
      'candypop.jp',
      'capoo.jp',
      'catfood.jp',
      'cheap.jp',
      'chicappa.jp',
      'chillout.jp',
      'chips.jp',
      'chowder.jp',
      'chu.jp',
      'ciao.jp',
      'cocotte.jp',
      'coolblog.jp',
      'cranky.jp',
      'cutegirl.jp',
      'daa.jp',
      'deca.jp',
      'deci.jp',
      'digick.jp',
      'egoism.jp',
      'fakefur.jp',
      'fem.jp',
      'flier.jp',
      'floppy.jp',
      'fool.jp',
      'frenchkiss.jp',
      'girlfriend.jp',
      'girly.jp',
      'gloomy.jp',
      'gonna.jp',
      'greater.jp',
      'hacca.jp',
      'heavy.jp',
      'her.jp',
      'hiho.jp',
      'hippy.jp',
      'holy.jp',
      'hungry.jp',
      'icurus.jp',
      'itigo.jp',
      'jellybean.jp',
      'kikirara.jp',
      'kill.jp',
      'kilo.jp',
      'kuron.jp',
      'littlestar.jp',
      'lolipopmc.jp',
      'lolitapunk.jp',
      'lomo.jp',
      'lovepop.jp',
      'lovesick.jp',
      'main.jp',
      'mods.jp',
      'mond.jp',
      'mongolian.jp',
      'moo.jp',
      'namaste.jp',
      'nikita.jp',
      'nobushi.jp',
      'noor.jp',
      'oops.jp',
      'parallel.jp',
      'parasite.jp',
      'pecori.jp',
      'peewee.jp',
      'penne.jp',
      'pepper.jp',
      'perma.jp',
      'pigboat.jp',
      'pinoko.jp',
      'punyu.jp',
      'pupu.jp',
      'pussycat.jp',
      'pya.jp',
      'raindrop.jp',
      'readymade.jp',
      'sadist.jp',
      'schoolbus.jp',
      'secret.jp',
      'staba.jp',
      'stripper.jp',
      'sub.jp',
      'sunnyday.jp',
      'thick.jp',
      'tonkotsu.jp',
      'under.jp',
      'upper.jp',
      'velvet.jp',
      'verse.jp',
      'versus.jp',
      'vivian.jp',
      'watson.jp',
      'weblike.jp',
      'whitesnow.jp',
      'zombie.jp',
      'heteml.net',
      'graphic.design',
      'goip.de',
      'blogspot.ae',
      'blogspot.al',
      'blogspot.am',
      '*.hosted.app',
      '*.run.app',
      'web.app',
      'blogspot.com.ar',
      'blogspot.co.at',
      'blogspot.com.au',
      'blogspot.ba',
      'blogspot.be',
      'blogspot.bg',
      'blogspot.bj',
      'blogspot.com.br',
      'blogspot.com.by',
      'blogspot.ca',
      'blogspot.cf',
      'blogspot.ch',
      'blogspot.cl',
      'blogspot.com.co',
      '*.0emm.com',
      'appspot.com',
      '*.r.appspot.com',
      'blogspot.com',
      'codespot.com',
      'googleapis.com',
      'googlecode.com',
      'pagespeedmobilizer.com',
      'withgoogle.com',
      'withyoutube.com',
      'blogspot.cv',
      'blogspot.com.cy',
      'blogspot.cz',
      'blogspot.de',
      '*.gateway.dev',
      'blogspot.dk',
      'blogspot.com.ee',
      'blogspot.com.eg',
      'blogspot.com.es',
      'blogspot.fi',
      'blogspot.fr',
      'cloud.goog',
      'translate.goog',
      '*.usercontent.goog',
      'blogspot.gr',
      'blogspot.hk',
      'blogspot.hr',
      'blogspot.hu',
      'blogspot.co.id',
      'blogspot.ie',
      'blogspot.co.il',
      'blogspot.in',
      'blogspot.is',
      'blogspot.it',
      'blogspot.jp',
      'blogspot.co.ke',
      'blogspot.kr',
      'blogspot.li',
      'blogspot.lt',
      'blogspot.lu',
      'blogspot.md',
      'blogspot.mk',
      'blogspot.com.mt',
      'blogspot.mx',
      'blogspot.my',
      'cloudfunctions.net',
      'blogspot.com.ng',
      'blogspot.nl',
      'blogspot.no',
      'blogspot.co.nz',
      'blogspot.pe',
      'blogspot.pt',
      'blogspot.qa',
      'blogspot.re',
      'blogspot.ro',
      'blogspot.rs',
      'blogspot.ru',
      'blogspot.se',
      'blogspot.sg',
      'blogspot.si',
      'blogspot.sk',
      'blogspot.sn',
      'blogspot.td',
      'blogspot.com.tr',
      'blogspot.tw',
      'blogspot.ug',
      'blogspot.co.uk',
      'blogspot.com.uy',
      'blogspot.vn',
      'blogspot.co.za',
      'goupile.fr',
      'pymnt.uk',
      'cloudapps.digital',
      'london.cloudapps.digital',
      'gov.nl',
      'grafana-dev.net',
      'grayjayleagues.com',
      'g\xFCnstigbestellen.de',
      'g\xFCnstigliefern.de',
      'fin.ci',
      'free.hr',
      'caa.li',
      'ua.rs',
      'conf.se',
      'h\xE4kkinen.fi',
      'hrsn.dev',
      'hashbang.sh',
      'hasura.app',
      'hasura-app.io',
      'hatenablog.com',
      'hatenadiary.com',
      'hateblo.jp',
      'hatenablog.jp',
      'hatenadiary.jp',
      'hatenadiary.org',
      'pages.it.hs-heilbronn.de',
      'pages-research.it.hs-heilbronn.de',
      'heiyu.space',
      'helioho.st',
      'heliohost.us',
      'hepforge.org',
      'herokuapp.com',
      'herokussl.com',
      'heyflow.page',
      'heyflow.site',
      'ravendb.cloud',
      'ravendb.community',
      'development.run',
      'ravendb.run',
      'homesklep.pl',
      '*.kin.one',
      '*.id.pub',
      '*.kin.pub',
      'secaas.hk',
      'hoplix.shop',
      'orx.biz',
      'biz.gl',
      'biz.ng',
      'co.biz.ng',
      'dl.biz.ng',
      'go.biz.ng',
      'lg.biz.ng',
      'on.biz.ng',
      'col.ng',
      'firm.ng',
      'gen.ng',
      'ltd.ng',
      'ngo.ng',
      'plc.ng',
      'ie.ua',
      'hostyhosting.io',
      'hf.space',
      'static.hf.space',
      'hypernode.io',
      'iobb.net',
      'co.cz',
      '*.moonscale.io',
      'moonscale.net',
      'gr.com',
      'iki.fi',
      'ibxos.it',
      'iliadboxos.it',
      'smushcdn.com',
      'wphostedmail.com',
      'wpmucdn.com',
      'tempurl.host',
      'wpmudev.host',
      'dyn-berlin.de',
      'in-berlin.de',
      'in-brb.de',
      'in-butter.de',
      'in-dsl.de',
      'in-vpn.de',
      'in-dsl.net',
      'in-vpn.net',
      'in-dsl.org',
      'in-vpn.org',
      'biz.at',
      'info.at',
      'info.cx',
      'ac.leg.br',
      'al.leg.br',
      'am.leg.br',
      'ap.leg.br',
      'ba.leg.br',
      'ce.leg.br',
      'df.leg.br',
      'es.leg.br',
      'go.leg.br',
      'ma.leg.br',
      'mg.leg.br',
      'ms.leg.br',
      'mt.leg.br',
      'pa.leg.br',
      'pb.leg.br',
      'pe.leg.br',
      'pi.leg.br',
      'pr.leg.br',
      'rj.leg.br',
      'rn.leg.br',
      'ro.leg.br',
      'rr.leg.br',
      'rs.leg.br',
      'sc.leg.br',
      'se.leg.br',
      'sp.leg.br',
      'to.leg.br',
      'pixolino.com',
      'na4u.ru',
      'apps-1and1.com',
      'live-website.com',
      'apps-1and1.net',
      'websitebuilder.online',
      'app-ionos.space',
      'iopsys.se',
      '*.dweb.link',
      'ipifony.net',
      'ir.md',
      'is-a-good.dev',
      'is-a.dev',
      'iservschule.de',
      'mein-iserv.de',
      'schulplattform.de',
      'schulserver.de',
      'test-iserv.de',
      'iserv.dev',
      'mel.cloudlets.com.au',
      'cloud.interhostsolutions.be',
      'alp1.ae.flow.ch',
      'appengine.flow.ch',
      'es-1.axarnet.cloud',
      'diadem.cloud',
      'vip.jelastic.cloud',
      'jele.cloud',
      'it1.eur.aruba.jenv-aruba.cloud',
      'it1.jenv-aruba.cloud',
      'keliweb.cloud',
      'cs.keliweb.cloud',
      'oxa.cloud',
      'tn.oxa.cloud',
      'uk.oxa.cloud',
      'primetel.cloud',
      'uk.primetel.cloud',
      'ca.reclaim.cloud',
      'uk.reclaim.cloud',
      'us.reclaim.cloud',
      'ch.trendhosting.cloud',
      'de.trendhosting.cloud',
      'jele.club',
      'dopaas.com',
      'paas.hosted-by-previder.com',
      'rag-cloud.hosteur.com',
      'rag-cloud-ch.hosteur.com',
      'jcloud.ik-server.com',
      'jcloud-ver-jpc.ik-server.com',
      'demo.jelastic.com',
      'paas.massivegrid.com',
      'jed.wafaicloud.com',
      'ryd.wafaicloud.com',
      'j.scaleforce.com.cy',
      'jelastic.dogado.eu',
      'fi.cloudplatform.fi',
      'demo.datacenter.fi',
      'paas.datacenter.fi',
      'jele.host',
      'mircloud.host',
      'paas.beebyte.io',
      'sekd1.beebyteapp.io',
      'jele.io',
      'jc.neen.it',
      'jcloud.kz',
      'cloudjiffy.net',
      'fra1-de.cloudjiffy.net',
      'west1-us.cloudjiffy.net',
      'jls-sto1.elastx.net',
      'jls-sto2.elastx.net',
      'jls-sto3.elastx.net',
      'fr-1.paas.massivegrid.net',
      'lon-1.paas.massivegrid.net',
      'lon-2.paas.massivegrid.net',
      'ny-1.paas.massivegrid.net',
      'ny-2.paas.massivegrid.net',
      'sg-1.paas.massivegrid.net',
      'jelastic.saveincloud.net',
      'nordeste-idc.saveincloud.net',
      'j.scaleforce.net',
      'sdscloud.pl',
      'unicloud.pl',
      'mircloud.ru',
      'enscaled.sg',
      'jele.site',
      'jelastic.team',
      'orangecloud.tn',
      'j.layershift.co.uk',
      'phx.enscaled.us',
      'mircloud.us',
      'myjino.ru',
      '*.hosting.myjino.ru',
      '*.landing.myjino.ru',
      '*.spectrum.myjino.ru',
      '*.vps.myjino.ru',
      'jotelulu.cloud',
      'webadorsite.com',
      'jouwweb.site',
      '*.cns.joyent.com',
      '*.triton.zone',
      'js.org',
      'kaas.gg',
      'khplay.nl',
      'kapsi.fi',
      'ezproxy.kuleuven.be',
      'kuleuven.cloud',
      'keymachine.de',
      'kinghost.net',
      'uni5.net',
      'knightpoint.systems',
      'koobin.events',
      'webthings.io',
      'krellian.net',
      'oya.to',
      'git-repos.de',
      'lcube-server.de',
      'svn-repos.de',
      'leadpages.co',
      'lpages.co',
      'lpusercontent.com',
      'lelux.site',
      'libp2p.direct',
      'runcontainers.dev',
      'co.business',
      'co.education',
      'co.events',
      'co.financial',
      'co.network',
      'co.place',
      'co.technology',
      'linkyard-cloud.ch',
      'linkyard.cloud',
      'members.linode.com',
      '*.nodebalancer.linode.com',
      '*.linodeobjects.com',
      'ip.linodeusercontent.com',
      'we.bs',
      'filegear-sg.me',
      'ggff.net',
      '*.user.localcert.dev',
      'lodz.pl',
      'pabianice.pl',
      'plock.pl',
      'sieradz.pl',
      'skierniewice.pl',
      'zgierz.pl',
      'loginline.app',
      'loginline.dev',
      'loginline.io',
      'loginline.services',
      'loginline.site',
      'lohmus.me',
      'servers.run',
      'krasnik.pl',
      'leczna.pl',
      'lubartow.pl',
      'lublin.pl',
      'poniatowa.pl',
      'swidnik.pl',
      'glug.org.uk',
      'lug.org.uk',
      'lugs.org.uk',
      'barsy.bg',
      'barsy.club',
      'barsycenter.com',
      'barsyonline.com',
      'barsy.de',
      'barsy.dev',
      'barsy.eu',
      'barsy.gr',
      'barsy.in',
      'barsy.info',
      'barsy.io',
      'barsy.me',
      'barsy.menu',
      'barsyonline.menu',
      'barsy.mobi',
      'barsy.net',
      'barsy.online',
      'barsy.org',
      'barsy.pro',
      'barsy.pub',
      'barsy.ro',
      'barsy.rs',
      'barsy.shop',
      'barsyonline.shop',
      'barsy.site',
      'barsy.store',
      'barsy.support',
      'barsy.uk',
      'barsy.co.uk',
      'barsyonline.co.uk',
      '*.magentosite.cloud',
      'hb.cldmail.ru',
      'matlab.cloud',
      'modelscape.com',
      'mwcloudnonprod.com',
      'polyspace.com',
      'mayfirst.info',
      'mayfirst.org',
      'mazeplay.com',
      'mcdir.me',
      'mcdir.ru',
      'vps.mcdir.ru',
      'mcpre.ru',
      'mediatech.by',
      'mediatech.dev',
      'hra.health',
      'medusajs.app',
      'miniserver.com',
      'memset.net',
      'messerli.app',
      'atmeta.com',
      'apps.fbsbx.com',
      '*.cloud.metacentrum.cz',
      'custom.metacentrum.cz',
      'flt.cloud.muni.cz',
      'usr.cloud.muni.cz',
      'meteorapp.com',
      'eu.meteorapp.com',
      'co.pl',
      '*.azurecontainer.io',
      'azure-api.net',
      'azure-mobile.net',
      'azureedge.net',
      'azurefd.net',
      'azurestaticapps.net',
      '1.azurestaticapps.net',
      '2.azurestaticapps.net',
      '3.azurestaticapps.net',
      '4.azurestaticapps.net',
      '5.azurestaticapps.net',
      '6.azurestaticapps.net',
      '7.azurestaticapps.net',
      'centralus.azurestaticapps.net',
      'eastasia.azurestaticapps.net',
      'eastus2.azurestaticapps.net',
      'westeurope.azurestaticapps.net',
      'westus2.azurestaticapps.net',
      'azurewebsites.net',
      'cloudapp.net',
      'trafficmanager.net',
      'blob.core.windows.net',
      'servicebus.windows.net',
      'routingthecloud.com',
      'sn.mynetname.net',
      'routingthecloud.net',
      'routingthecloud.org',
      'csx.cc',
      'mydbserver.com',
      'webspaceconfig.de',
      'mittwald.info',
      'mittwaldserver.info',
      'typo3server.info',
      'project.space',
      'modx.dev',
      'bmoattachments.org',
      'net.ru',
      'org.ru',
      'pp.ru',
      'hostedpi.com',
      'caracal.mythic-beasts.com',
      'customer.mythic-beasts.com',
      'fentiger.mythic-beasts.com',
      'lynx.mythic-beasts.com',
      'ocelot.mythic-beasts.com',
      'oncilla.mythic-beasts.com',
      'onza.mythic-beasts.com',
      'sphinx.mythic-beasts.com',
      'vs.mythic-beasts.com',
      'x.mythic-beasts.com',
      'yali.mythic-beasts.com',
      'cust.retrosnub.co.uk',
      'ui.nabu.casa',
      'cloud.nospamproxy.com',
      'netfy.app',
      'netlify.app',
      '4u.com',
      'nfshost.com',
      'ipfs.nftstorage.link',
      'ngo.us',
      'ngrok.app',
      'ngrok-free.app',
      'ngrok.dev',
      'ngrok-free.dev',
      'ngrok.io',
      'ap.ngrok.io',
      'au.ngrok.io',
      'eu.ngrok.io',
      'in.ngrok.io',
      'jp.ngrok.io',
      'sa.ngrok.io',
      'us.ngrok.io',
      'ngrok.pizza',
      'ngrok.pro',
      'torun.pl',
      'nh-serv.co.uk',
      'nimsite.uk',
      'mmafan.biz',
      'myftp.biz',
      'no-ip.biz',
      'no-ip.ca',
      'fantasyleague.cc',
      'gotdns.ch',
      '3utilities.com',
      'blogsyte.com',
      'ciscofreak.com',
      'damnserver.com',
      'ddnsking.com',
      'ditchyourip.com',
      'dnsiskinky.com',
      'dynns.com',
      'geekgalaxy.com',
      'health-carereform.com',
      'homesecuritymac.com',
      'homesecuritypc.com',
      'myactivedirectory.com',
      'mysecuritycamera.com',
      'myvnc.com',
      'net-freaks.com',
      'onthewifi.com',
      'point2this.com',
      'quicksytes.com',
      'securitytactics.com',
      'servebeer.com',
      'servecounterstrike.com',
      'serveexchange.com',
      'serveftp.com',
      'servegame.com',
      'servehalflife.com',
      'servehttp.com',
      'servehumour.com',
      'serveirc.com',
      'servemp3.com',
      'servep2p.com',
      'servepics.com',
      'servequake.com',
      'servesarcasm.com',
      'stufftoread.com',
      'unusualperson.com',
      'workisboring.com',
      'dvrcam.info',
      'ilovecollege.info',
      'no-ip.info',
      'brasilia.me',
      'ddns.me',
      'dnsfor.me',
      'hopto.me',
      'loginto.me',
      'noip.me',
      'webhop.me',
      'bounceme.net',
      'ddns.net',
      'eating-organic.net',
      'mydissent.net',
      'myeffect.net',
      'mymediapc.net',
      'mypsx.net',
      'mysecuritycamera.net',
      'nhlfan.net',
      'no-ip.net',
      'pgafan.net',
      'privatizehealthinsurance.net',
      'redirectme.net',
      'serveblog.net',
      'serveminecraft.net',
      'sytes.net',
      'cable-modem.org',
      'collegefan.org',
      'couchpotatofries.org',
      'hopto.org',
      'mlbfan.org',
      'myftp.org',
      'mysecuritycamera.org',
      'nflfan.org',
      'no-ip.org',
      'read-books.org',
      'ufcfan.org',
      'zapto.org',
      'no-ip.co.uk',
      'golffan.us',
      'noip.us',
      'pointto.us',
      'stage.nodeart.io',
      '*.developer.app',
      'noop.app',
      '*.northflank.app',
      '*.build.run',
      '*.code.run',
      '*.database.run',
      '*.migration.run',
      'noticeable.news',
      'notion.site',
      'dnsking.ch',
      'mypi.co',
      'n4t.co',
      '001www.com',
      'myiphost.com',
      'forumz.info',
      'soundcast.me',
      'tcp4.me',
      'dnsup.net',
      'hicam.net',
      'now-dns.net',
      'ownip.net',
      'vpndns.net',
      'dynserv.org',
      'now-dns.org',
      'x443.pw',
      'now-dns.top',
      'ntdll.top',
      'freeddns.us',
      'nsupdate.info',
      'nerdpol.ovh',
      'nyc.mn',
      'prvcy.page',
      'obl.ong',
      'observablehq.cloud',
      'static.observableusercontent.com',
      'omg.lol',
      'cloudycluster.net',
      'omniwe.site',
      '123webseite.at',
      '123website.be',
      'simplesite.com.br',
      '123website.ch',
      'simplesite.com',
      '123webseite.de',
      '123hjemmeside.dk',
      '123miweb.es',
      '123kotisivu.fi',
      '123siteweb.fr',
      'simplesite.gr',
      '123homepage.it',
      '123website.lu',
      '123website.nl',
      '123hjemmeside.no',
      'service.one',
      'simplesite.pl',
      '123paginaweb.pt',
      '123minsida.se',
      'is-a-fullstack.dev',
      'is-cool.dev',
      'is-not-a.dev',
      'localplayer.dev',
      'is-local.org',
      'opensocial.site',
      'opencraft.hosting',
      '16-b.it',
      '32-b.it',
      '64-b.it',
      'orsites.com',
      'operaunite.com',
      '*.customer-oci.com',
      '*.oci.customer-oci.com',
      '*.ocp.customer-oci.com',
      '*.ocs.customer-oci.com',
      '*.oraclecloudapps.com',
      '*.oraclegovcloudapps.com',
      '*.oraclegovcloudapps.uk',
      'tech.orange',
      'can.re',
      'authgear-staging.com',
      'authgearapps.com',
      'skygearapp.com',
      'outsystemscloud.com',
      '*.hosting.ovh.net',
      '*.webpaas.ovh.net',
      'ownprovider.com',
      'own.pm',
      '*.owo.codes',
      'ox.rs',
      'oy.lc',
      'pgfog.com',
      'pagexl.com',
      'gotpantheon.com',
      'pantheonsite.io',
      '*.paywhirl.com',
      '*.xmit.co',
      'xmit.dev',
      'madethis.site',
      'srv.us',
      'gh.srv.us',
      'gl.srv.us',
      'lk3.ru',
      'mypep.link',
      'perspecta.cloud',
      'on-web.fr',
      '*.upsun.app',
      'upsunapp.com',
      'ent.platform.sh',
      'eu.platform.sh',
      'us.platform.sh',
      '*.platformsh.site',
      '*.tst.site',
      'platter-app.com',
      'platter-app.dev',
      'platterp.us',
      'pley.games',
      'onporter.run',
      'co.bn',
      'postman-echo.com',
      'pstmn.io',
      'mock.pstmn.io',
      'httpbin.org',
      'prequalifyme.today',
      'xen.prgmr.com',
      'priv.at',
      'protonet.io',
      'chirurgiens-dentistes-en-france.fr',
      'byen.site',
      'pubtls.org',
      'pythonanywhere.com',
      'eu.pythonanywhere.com',
      'qa2.com',
      'qcx.io',
      '*.sys.qcx.io',
      'myqnapcloud.cn',
      'alpha-myqnapcloud.com',
      'dev-myqnapcloud.com',
      'mycloudnas.com',
      'mynascloud.com',
      'myqnapcloud.com',
      'qoto.io',
      'qualifioapp.com',
      'ladesk.com',
      'qbuser.com',
      '*.quipelements.com',
      'vapor.cloud',
      'vaporcloud.io',
      'rackmaze.com',
      'rackmaze.net',
      'cloudsite.builders',
      'myradweb.net',
      'servername.us',
      'web.in',
      'in.net',
      'myrdbx.io',
      'site.rb-hosting.io',
      '*.on-rancher.cloud',
      '*.on-k3s.io',
      '*.on-rio.io',
      'ravpage.co.il',
      'readthedocs-hosted.com',
      'readthedocs.io',
      'rhcloud.com',
      'instances.spawn.cc',
      'onrender.com',
      'app.render.com',
      'replit.app',
      'id.replit.app',
      'firewalledreplit.co',
      'id.firewalledreplit.co',
      'repl.co',
      'id.repl.co',
      'replit.dev',
      'archer.replit.dev',
      'bones.replit.dev',
      'canary.replit.dev',
      'global.replit.dev',
      'hacker.replit.dev',
      'id.replit.dev',
      'janeway.replit.dev',
      'kim.replit.dev',
      'kira.replit.dev',
      'kirk.replit.dev',
      'odo.replit.dev',
      'paris.replit.dev',
      'picard.replit.dev',
      'pike.replit.dev',
      'prerelease.replit.dev',
      'reed.replit.dev',
      'riker.replit.dev',
      'sisko.replit.dev',
      'spock.replit.dev',
      'staging.replit.dev',
      'sulu.replit.dev',
      'tarpit.replit.dev',
      'teams.replit.dev',
      'tucker.replit.dev',
      'wesley.replit.dev',
      'worf.replit.dev',
      'repl.run',
      'resindevice.io',
      'devices.resinstaging.io',
      'hzc.io',
      'adimo.co.uk',
      'itcouldbewor.se',
      'aus.basketball',
      'nz.basketball',
      'git-pages.rit.edu',
      'rocky.page',
      'rub.de',
      'ruhr-uni-bochum.de',
      'io.noc.ruhr-uni-bochum.de',
      '\u0431\u0438\u0437.\u0440\u0443\u0441',
      '\u043A\u043E\u043C.\u0440\u0443\u0441',
      '\u043A\u0440\u044B\u043C.\u0440\u0443\u0441',
      '\u043C\u0438\u0440.\u0440\u0443\u0441',
      '\u043C\u0441\u043A.\u0440\u0443\u0441',
      '\u043E\u0440\u0433.\u0440\u0443\u0441',
      '\u0441\u0430\u043C\u0430\u0440\u0430.\u0440\u0443\u0441',
      '\u0441\u043E\u0447\u0438.\u0440\u0443\u0441',
      '\u0441\u043F\u0431.\u0440\u0443\u0441',
      '\u044F.\u0440\u0443\u0441',
      'ras.ru',
      'nyat.app',
      '180r.com',
      'dojin.com',
      'sakuratan.com',
      'sakuraweb.com',
      'x0.com',
      '2-d.jp',
      'bona.jp',
      'crap.jp',
      'daynight.jp',
      'eek.jp',
      'flop.jp',
      'halfmoon.jp',
      'jeez.jp',
      'matrix.jp',
      'mimoza.jp',
      'ivory.ne.jp',
      'mail-box.ne.jp',
      'mints.ne.jp',
      'mokuren.ne.jp',
      'opal.ne.jp',
      'sakura.ne.jp',
      'sumomo.ne.jp',
      'topaz.ne.jp',
      'netgamers.jp',
      'nyanta.jp',
      'o0o0.jp',
      'rdy.jp',
      'rgr.jp',
      'rulez.jp',
      's3.isk01.sakurastorage.jp',
      's3.isk02.sakurastorage.jp',
      'saloon.jp',
      'sblo.jp',
      'skr.jp',
      'tank.jp',
      'uh-oh.jp',
      'undo.jp',
      'rs.webaccel.jp',
      'user.webaccel.jp',
      'websozai.jp',
      'xii.jp',
      'squares.net',
      'jpn.org',
      'kirara.st',
      'x0.to',
      'from.tv',
      'sakura.tv',
      '*.builder.code.com',
      '*.dev-builder.code.com',
      '*.stg-builder.code.com',
      '*.001.test.code-builder-stg.platform.salesforce.com',
      '*.d.crm.dev',
      '*.w.crm.dev',
      '*.wa.crm.dev',
      '*.wb.crm.dev',
      '*.wc.crm.dev',
      '*.wd.crm.dev',
      '*.we.crm.dev',
      '*.wf.crm.dev',
      'sandcats.io',
      'logoip.com',
      'logoip.de',
      'fr-par-1.baremetal.scw.cloud',
      'fr-par-2.baremetal.scw.cloud',
      'nl-ams-1.baremetal.scw.cloud',
      'cockpit.fr-par.scw.cloud',
      'fnc.fr-par.scw.cloud',
      'functions.fnc.fr-par.scw.cloud',
      'k8s.fr-par.scw.cloud',
      'nodes.k8s.fr-par.scw.cloud',
      's3.fr-par.scw.cloud',
      's3-website.fr-par.scw.cloud',
      'whm.fr-par.scw.cloud',
      'priv.instances.scw.cloud',
      'pub.instances.scw.cloud',
      'k8s.scw.cloud',
      'cockpit.nl-ams.scw.cloud',
      'k8s.nl-ams.scw.cloud',
      'nodes.k8s.nl-ams.scw.cloud',
      's3.nl-ams.scw.cloud',
      's3-website.nl-ams.scw.cloud',
      'whm.nl-ams.scw.cloud',
      'cockpit.pl-waw.scw.cloud',
      'k8s.pl-waw.scw.cloud',
      'nodes.k8s.pl-waw.scw.cloud',
      's3.pl-waw.scw.cloud',
      's3-website.pl-waw.scw.cloud',
      'scalebook.scw.cloud',
      'smartlabeling.scw.cloud',
      'dedibox.fr',
      'schokokeks.net',
      'gov.scot',
      'service.gov.scot',
      'scrysec.com',
      'client.scrypted.io',
      'firewall-gateway.com',
      'firewall-gateway.de',
      'my-gateway.de',
      'my-router.de',
      'spdns.de',
      'spdns.eu',
      'firewall-gateway.net',
      'my-firewall.org',
      'myfirewall.org',
      'spdns.org',
      'seidat.net',
      'sellfy.store',
      'minisite.ms',
      'senseering.net',
      'servebolt.cloud',
      'biz.ua',
      'co.ua',
      'pp.ua',
      'as.sh.cn',
      'sheezy.games',
      'shiftedit.io',
      'myshopblocks.com',
      'myshopify.com',
      'shopitsite.com',
      'shopware.shop',
      'shopware.store',
      'mo-siemens.io',
      '1kapp.com',
      'appchizi.com',
      'applinzi.com',
      'sinaapp.com',
      'vipsinaapp.com',
      'siteleaf.net',
      'small-web.org',
      'aeroport.fr',
      'avocat.fr',
      'chambagri.fr',
      'chirurgiens-dentistes.fr',
      'experts-comptables.fr',
      'medecin.fr',
      'notaires.fr',
      'pharmacien.fr',
      'port.fr',
      'veterinaire.fr',
      'vp4.me',
      '*.snowflake.app',
      '*.privatelink.snowflake.app',
      'streamlit.app',
      'streamlitapp.com',
      'try-snowplow.com',
      'mafelo.net',
      'playstation-cloud.com',
      'srht.site',
      'apps.lair.io',
      '*.stolos.io',
      'spacekit.io',
      'ind.mom',
      'customer.speedpartner.de',
      'myspreadshop.at',
      'myspreadshop.com.au',
      'myspreadshop.be',
      'myspreadshop.ca',
      'myspreadshop.ch',
      'myspreadshop.com',
      'myspreadshop.de',
      'myspreadshop.dk',
      'myspreadshop.es',
      'myspreadshop.fi',
      'myspreadshop.fr',
      'myspreadshop.ie',
      'myspreadshop.it',
      'myspreadshop.net',
      'myspreadshop.nl',
      'myspreadshop.no',
      'myspreadshop.pl',
      'myspreadshop.se',
      'myspreadshop.co.uk',
      'w-corp-staticblitz.com',
      'w-credentialless-staticblitz.com',
      'w-staticblitz.com',
      'stackhero-network.com',
      'runs.onstackit.cloud',
      'stackit.gg',
      'stackit.rocks',
      'stackit.run',
      'stackit.zone',
      'musician.io',
      'novecore.site',
      'api.stdlib.com',
      'feedback.ac',
      'forms.ac',
      'assessments.cx',
      'calculators.cx',
      'funnels.cx',
      'paynow.cx',
      'quizzes.cx',
      'researched.cx',
      'tests.cx',
      'surveys.so',
      'storebase.store',
      'storipress.app',
      'storj.farm',
      'strapiapp.com',
      'media.strapiapp.com',
      'vps-host.net',
      'atl.jelastic.vps-host.net',
      'njs.jelastic.vps-host.net',
      'ric.jelastic.vps-host.net',
      'streak-link.com',
      'streaklinks.com',
      'streakusercontent.com',
      'soc.srcf.net',
      'user.srcf.net',
      'utwente.io',
      'temp-dns.com',
      'supabase.co',
      'supabase.in',
      'supabase.net',
      'syncloud.it',
      'dscloud.biz',
      'direct.quickconnect.cn',
      'dsmynas.com',
      'familyds.com',
      'diskstation.me',
      'dscloud.me',
      'i234.me',
      'myds.me',
      'synology.me',
      'dscloud.mobi',
      'dsmynas.net',
      'familyds.net',
      'dsmynas.org',
      'familyds.org',
      'direct.quickconnect.to',
      'vpnplus.to',
      'mytabit.com',
      'mytabit.co.il',
      'tabitorder.co.il',
      'taifun-dns.de',
      'ts.net',
      '*.c.ts.net',
      'gda.pl',
      'gdansk.pl',
      'gdynia.pl',
      'med.pl',
      'sopot.pl',
      'taveusercontent.com',
      'p.tawk.email',
      'p.tawkto.email',
      'site.tb-hosting.com',
      'edugit.io',
      's3.teckids.org',
      'telebit.app',
      'telebit.io',
      '*.telebit.xyz',
      '*.firenet.ch',
      '*.svc.firenet.ch',
      'reservd.com',
      'thingdustdata.com',
      'cust.dev.thingdust.io',
      'reservd.dev.thingdust.io',
      'cust.disrec.thingdust.io',
      'reservd.disrec.thingdust.io',
      'cust.prod.thingdust.io',
      'cust.testing.thingdust.io',
      'reservd.testing.thingdust.io',
      'tickets.io',
      'arvo.network',
      'azimuth.network',
      'tlon.network',
      'torproject.net',
      'pages.torproject.net',
      'townnews-staging.com',
      '12hp.at',
      '2ix.at',
      '4lima.at',
      'lima-city.at',
      '12hp.ch',
      '2ix.ch',
      '4lima.ch',
      'lima-city.ch',
      'trafficplex.cloud',
      'de.cool',
      '12hp.de',
      '2ix.de',
      '4lima.de',
      'lima-city.de',
      '1337.pictures',
      'clan.rip',
      'lima-city.rocks',
      'webspace.rocks',
      'lima.zone',
      '*.transurl.be',
      '*.transurl.eu',
      'site.transip.me',
      '*.transurl.nl',
      'tuxfamily.org',
      'dd-dns.de',
      'dray-dns.de',
      'draydns.de',
      'dyn-vpn.de',
      'dynvpn.de',
      'mein-vigor.de',
      'my-vigor.de',
      'my-wan.de',
      'syno-ds.de',
      'synology-diskstation.de',
      'synology-ds.de',
      'diskstation.eu',
      'diskstation.org',
      'typedream.app',
      'pro.typeform.com',
      '*.uberspace.de',
      'uber.space',
      'hk.com',
      'inc.hk',
      'ltd.hk',
      'hk.org',
      'it.com',
      'unison-services.cloud',
      'virtual-user.de',
      'virtualuser.de',
      'name.pm',
      'sch.tf',
      'biz.wf',
      'sch.wf',
      'org.yt',
      'rs.ba',
      'bielsko.pl',
      'upli.io',
      'urown.cloud',
      'dnsupdate.info',
      'us.org',
      'v.ua',
      'express.val.run',
      'web.val.run',
      'vercel.app',
      'v0.build',
      'vercel.dev',
      'vusercontent.net',
      'now.sh',
      '2038.io',
      'router.management',
      'v-info.info',
      'voorloper.cloud',
      '*.vultrobjects.com',
      'wafflecell.com',
      'webflow.io',
      'webflowtest.io',
      '*.webhare.dev',
      'bookonline.app',
      'hotelwithflight.com',
      'reserve-online.com',
      'reserve-online.net',
      'cprapid.com',
      'pleskns.com',
      'wp2.host',
      'pdns.page',
      'plesk.page',
      'wpsquared.site',
      '*.wadl.top',
      'remotewd.com',
      'box.ca',
      'pages.wiardweb.com',
      'toolforge.org',
      'wmcloud.org',
      'wmflabs.org',
      'wdh.app',
      'panel.gg',
      'daemon.panel.gg',
      'wixsite.com',
      'wixstudio.com',
      'editorx.io',
      'wixstudio.io',
      'wix.run',
      'messwithdns.com',
      'woltlab-demo.com',
      'myforum.community',
      'community-pro.de',
      'diskussionsbereich.de',
      'community-pro.net',
      'meinforum.net',
      'affinitylottery.org.uk',
      'raffleentry.org.uk',
      'weeklylottery.org.uk',
      'wpenginepowered.com',
      'js.wpenginepowered.com',
      'half.host',
      'xnbay.com',
      'u2.xnbay.com',
      'u2-local.xnbay.com',
      'cistron.nl',
      'demon.nl',
      'xs4all.space',
      'yandexcloud.net',
      'storage.yandexcloud.net',
      'website.yandexcloud.net',
      'official.academy',
      'yolasite.com',
      'yombo.me',
      'ynh.fr',
      'nohost.me',
      'noho.st',
      'za.net',
      'za.org',
      'zap.cloud',
      'zeabur.app',
      'bss.design',
      'basicserver.io',
      'virtualserver.io',
      'enterprisecloud.nu',
    ];
    var Z = Y.reduce((e, s) => {
      const c = s.replace(/^(\*\.|\!)/, ''),
        o = A.toASCII(c),
        t = s.charAt(0);
      if (e.has(o)) throw new Error(`Multiple rules found for ${s} (${o})`);
      return (
        e.set(o, {
          rule: s,
          suffix: c,
          punySuffix: o,
          wildcard: t === '*',
          exception: t === '!',
        }),
        e
      );
    }, /* @__PURE__ */ new Map());
    var aa = /* @__PURE__ */ __name((e) => {
      const c = A.toASCII(e).split('.');
      for (let o = 0; o < c.length; o++) {
        const t = c.slice(o).join('.'),
          d = Z.get(t);
        if (d) return d;
      }
      return null;
    }, 'aa');
    var H = {
      DOMAIN_TOO_SHORT: 'Domain name too short.',
      DOMAIN_TOO_LONG:
        'Domain name too long. It should be no more than 255 chars.',
      LABEL_STARTS_WITH_DASH: 'Domain name label can not start with a dash.',
      LABEL_ENDS_WITH_DASH: 'Domain name label can not end with a dash.',
      LABEL_TOO_LONG: 'Domain name label should be at most 63 chars long.',
      LABEL_TOO_SHORT: 'Domain name label should be at least 1 character long.',
      LABEL_INVALID_CHARS:
        'Domain name label can only contain alphanumeric characters or dashes.',
    };
    var oa = /* @__PURE__ */ __name((e) => {
      const s = A.toASCII(e);
      if (s.length < 1) return 'DOMAIN_TOO_SHORT';
      if (s.length > 255) return 'DOMAIN_TOO_LONG';
      const c = s.split('.');
      let o;
      for (let t = 0; t < c.length; ++t) {
        if (((o = c[t]), !o.length)) return 'LABEL_TOO_SHORT';
        if (o.length > 63) return 'LABEL_TOO_LONG';
        if (o.charAt(0) === '-') return 'LABEL_STARTS_WITH_DASH';
        if (o.charAt(o.length - 1) === '-') return 'LABEL_ENDS_WITH_DASH';
        if (!/^[a-z0-9\-_]+$/.test(o)) return 'LABEL_INVALID_CHARS';
      }
    }, 'oa');
    var _ = /* @__PURE__ */ __name((e) => {
      if (typeof e != 'string')
        throw new TypeError('Domain name must be a string.');
      let s = e.slice(0).toLowerCase();
      s.charAt(s.length - 1) === '.' && (s = s.slice(0, s.length - 1));
      const c = oa(s);
      if (c) return { input: e, error: { message: H[c], code: c } };
      const o = {
          input: e,
          tld: null,
          sld: null,
          domain: null,
          subdomain: null,
          listed: false,
        },
        t = s.split('.');
      if (t[t.length - 1] === 'local') return o;
      const d = /* @__PURE__ */ __name(
          () => (
            /xn--/.test(s) &&
              (o.domain && (o.domain = A.toASCII(o.domain)),
              o.subdomain && (o.subdomain = A.toASCII(o.subdomain))),
            o
          ),
          'd'
        ),
        z = aa(s);
      if (!z)
        return t.length < 2
          ? o
          : ((o.tld = t.pop()),
            (o.sld = t.pop()),
            (o.domain = [o.sld, o.tld].join('.')),
            t.length && (o.subdomain = t.pop()),
            d());
      o.listed = true;
      const y = z.suffix.split('.'),
        g = t.slice(0, t.length - y.length);
      return (
        z.exception && g.push(y.shift()),
        (o.tld = y.join('.')),
        !g.length ||
          (z.wildcard && (y.unshift(g.pop()), (o.tld = y.join('.'))),
          !g.length) ||
          ((o.sld = g.pop()),
          (o.domain = [o.sld, o.tld].join('.')),
          g.length && (o.subdomain = g.join('.'))),
        d()
      );
    }, '_');
    var N = /* @__PURE__ */ __name((e) => (e && _(e).domain) || null, 'N');
    var R = /* @__PURE__ */ __name((e) => {
      const s = _(e);
      return !!(s.domain && s.listed);
    }, 'R');
    var sa = { parse: _, get: N, isValid: R };
    exports.default = sa;
    exports.errorCodes = H;
    exports.get = N;
    exports.isValid = R;
    exports.parse = _;
  },
});

// node_modules/tough-cookie/lib/pubsuffix-psl.js
var require_pubsuffix_psl = __commonJS({
  'node_modules/tough-cookie/lib/pubsuffix-psl.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var psl = require_psl();
    var SPECIAL_USE_DOMAINS = [
      'local',
      'example',
      'invalid',
      'localhost',
      'test',
    ];
    var SPECIAL_TREATMENT_DOMAINS = ['localhost', 'invalid'];
    function getPublicSuffix(domain2, options3 = {}) {
      const domainParts = domain2.split('.');
      const topLevelDomain = domainParts[domainParts.length - 1];
      const allowSpecialUseDomain = !!options3.allowSpecialUseDomain;
      const ignoreError = !!options3.ignoreError;
      if (
        allowSpecialUseDomain &&
        SPECIAL_USE_DOMAINS.includes(topLevelDomain)
      ) {
        if (domainParts.length > 1) {
          const secondLevelDomain = domainParts[domainParts.length - 2];
          return `${secondLevelDomain}.${topLevelDomain}`;
        } else if (SPECIAL_TREATMENT_DOMAINS.includes(topLevelDomain)) {
          return `${topLevelDomain}`;
        }
      }
      if (!ignoreError && SPECIAL_USE_DOMAINS.includes(topLevelDomain)) {
        throw new Error(
          `Cookie has domain set to the public suffix "${topLevelDomain}" which is a special use domain. To allow this, configure your CookieJar with {allowSpecialUseDomain:true, rejectPublicSuffixes: false}.`
        );
      }
      return psl.get(domain2);
    }
    __name(getPublicSuffix, 'getPublicSuffix');
    exports.getPublicSuffix = getPublicSuffix;
  },
});

// node_modules/tough-cookie/lib/store.js
var require_store = __commonJS({
  'node_modules/tough-cookie/lib/store.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var Store = class {
      static {
        __name(this, 'Store');
      }
      constructor() {
        this.synchronous = false;
      }
      findCookie(domain2, path, key, cb) {
        throw new Error('findCookie is not implemented');
      }
      findCookies(domain2, path, allowSpecialUseDomain, cb) {
        throw new Error('findCookies is not implemented');
      }
      putCookie(cookie, cb) {
        throw new Error('putCookie is not implemented');
      }
      updateCookie(oldCookie, newCookie, cb) {
        throw new Error('updateCookie is not implemented');
      }
      removeCookie(domain2, path, key, cb) {
        throw new Error('removeCookie is not implemented');
      }
      removeCookies(domain2, path, cb) {
        throw new Error('removeCookies is not implemented');
      }
      removeAllCookies(cb) {
        throw new Error('removeAllCookies is not implemented');
      }
      getAllCookies(cb) {
        throw new Error(
          'getAllCookies is not implemented (therefore jar cannot be serialized)'
        );
      }
    };
    exports.Store = Store;
  },
});

// node_modules/universalify/index.js
var require_universalify = __commonJS({
  'node_modules/universalify/index.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    exports.fromCallback = function (fn) {
      return Object.defineProperty(
        function () {
          if (typeof arguments[arguments.length - 1] === 'function')
            fn.apply(this, arguments);
          else {
            return new Promise((resolve, reject) => {
              arguments[arguments.length] = (err, res) => {
                if (err) return reject(err);
                resolve(res);
              };
              arguments.length++;
              fn.apply(this, arguments);
            });
          }
        },
        'name',
        { value: fn.name }
      );
    };
    exports.fromPromise = function (fn) {
      return Object.defineProperty(
        function () {
          const cb = arguments[arguments.length - 1];
          if (typeof cb !== 'function') return fn.apply(this, arguments);
          else {
            delete arguments[arguments.length - 1];
            arguments.length--;
            fn.apply(this, arguments).then((r) => cb(null, r), cb);
          }
        },
        'name',
        { value: fn.name }
      );
    };
  },
});

// node_modules/tough-cookie/lib/permuteDomain.js
var require_permuteDomain = __commonJS({
  'node_modules/tough-cookie/lib/permuteDomain.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var pubsuffix = require_pubsuffix_psl();
    function permuteDomain(domain2, allowSpecialUseDomain) {
      const pubSuf = pubsuffix.getPublicSuffix(domain2, {
        allowSpecialUseDomain,
      });
      if (!pubSuf) {
        return null;
      }
      if (pubSuf == domain2) {
        return [domain2];
      }
      if (domain2.slice(-1) == '.') {
        domain2 = domain2.slice(0, -1);
      }
      const prefix = domain2.slice(0, -(pubSuf.length + 1));
      const parts = prefix.split('.').reverse();
      let cur = pubSuf;
      const permutations = [cur];
      while (parts.length) {
        cur = `${parts.shift()}.${cur}`;
        permutations.push(cur);
      }
      return permutations;
    }
    __name(permuteDomain, 'permuteDomain');
    exports.permuteDomain = permuteDomain;
  },
});

// node_modules/tough-cookie/lib/pathMatch.js
var require_pathMatch = __commonJS({
  'node_modules/tough-cookie/lib/pathMatch.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    function pathMatch(reqPath, cookiePath) {
      if (cookiePath === reqPath) {
        return true;
      }
      const idx = reqPath.indexOf(cookiePath);
      if (idx === 0) {
        if (cookiePath.substr(-1) === '/') {
          return true;
        }
        if (reqPath.substr(cookiePath.length, 1) === '/') {
          return true;
        }
      }
      return false;
    }
    __name(pathMatch, 'pathMatch');
    exports.pathMatch = pathMatch;
  },
});

// node-built-in-modules:util
import libDefault from 'util';
var require_util = __commonJS({
  'node-built-in-modules:util'(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = libDefault;
  },
});

// node_modules/tough-cookie/lib/utilHelper.js
var require_utilHelper = __commonJS({
  'node_modules/tough-cookie/lib/utilHelper.js'(exports) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    function requireUtil() {
      try {
        return require_util();
      } catch (e) {
        return null;
      }
    }
    __name(requireUtil, 'requireUtil');
    function lookupCustomInspectSymbol() {
      return Symbol.for('nodejs.util.inspect.custom');
    }
    __name(lookupCustomInspectSymbol, 'lookupCustomInspectSymbol');
    function tryReadingCustomSymbolFromUtilInspect(options3) {
      const _requireUtil = options3.requireUtil || requireUtil;
      const util = _requireUtil();
      return util ? util.inspect.custom : null;
    }
    __name(
      tryReadingCustomSymbolFromUtilInspect,
      'tryReadingCustomSymbolFromUtilInspect'
    );
    exports.getUtilInspect = /* @__PURE__ */ __name(function getUtilInspect(
      fallback,
      options3 = {}
    ) {
      const _requireUtil = options3.requireUtil || requireUtil;
      const util = _requireUtil();
      return /* @__PURE__ */ __name(function inspect(value, showHidden, depth) {
        return util ? util.inspect(value, showHidden, depth) : fallback(value);
      }, 'inspect');
    }, 'getUtilInspect');
    exports.getCustomInspectSymbol = /* @__PURE__ */ __name(
      function getCustomInspectSymbol(options3 = {}) {
        const _lookupCustomInspectSymbol =
          options3.lookupCustomInspectSymbol || lookupCustomInspectSymbol;
        return (
          _lookupCustomInspectSymbol() ||
          tryReadingCustomSymbolFromUtilInspect(options3)
        );
      },
      'getCustomInspectSymbol'
    );
  },
});

// node_modules/tough-cookie/lib/memstore.js
var require_memstore = __commonJS({
  'node_modules/tough-cookie/lib/memstore.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var { fromCallback } = require_universalify();
    var Store = require_store().Store;
    var permuteDomain = require_permuteDomain().permuteDomain;
    var pathMatch = require_pathMatch().pathMatch;
    var { getCustomInspectSymbol, getUtilInspect } = require_utilHelper();
    var MemoryCookieStore = class extends Store {
      static {
        __name(this, 'MemoryCookieStore');
      }
      constructor() {
        super();
        this.synchronous = true;
        this.idx = /* @__PURE__ */ Object.create(null);
        const customInspectSymbol = getCustomInspectSymbol();
        if (customInspectSymbol) {
          this[customInspectSymbol] = this.inspect;
        }
      }
      inspect() {
        const util = { inspect: getUtilInspect(inspectFallback) };
        return `{ idx: ${util.inspect(this.idx, false, 2)} }`;
      }
      findCookie(domain2, path, key, cb) {
        if (!this.idx[domain2]) {
          return cb(null, void 0);
        }
        if (!this.idx[domain2][path]) {
          return cb(null, void 0);
        }
        return cb(null, this.idx[domain2][path][key] || null);
      }
      findCookies(domain2, path, allowSpecialUseDomain, cb) {
        const results = [];
        if (typeof allowSpecialUseDomain === 'function') {
          cb = allowSpecialUseDomain;
          allowSpecialUseDomain = true;
        }
        if (!domain2) {
          return cb(null, []);
        }
        let pathMatcher;
        if (!path) {
          pathMatcher = /* @__PURE__ */ __name(function matchAll(domainIndex) {
            for (const curPath in domainIndex) {
              const pathIndex = domainIndex[curPath];
              for (const key in pathIndex) {
                results.push(pathIndex[key]);
              }
            }
          }, 'matchAll');
        } else {
          pathMatcher = /* @__PURE__ */ __name(function matchRFC(domainIndex) {
            Object.keys(domainIndex).forEach((cookiePath) => {
              if (pathMatch(path, cookiePath)) {
                const pathIndex = domainIndex[cookiePath];
                for (const key in pathIndex) {
                  results.push(pathIndex[key]);
                }
              }
            });
          }, 'matchRFC');
        }
        const domains = permuteDomain(domain2, allowSpecialUseDomain) || [
          domain2,
        ];
        const idx = this.idx;
        domains.forEach((curDomain) => {
          const domainIndex = idx[curDomain];
          if (!domainIndex) {
            return;
          }
          pathMatcher(domainIndex);
        });
        cb(null, results);
      }
      putCookie(cookie, cb) {
        if (!this.idx[cookie.domain]) {
          this.idx[cookie.domain] = /* @__PURE__ */ Object.create(null);
        }
        if (!this.idx[cookie.domain][cookie.path]) {
          this.idx[cookie.domain][cookie.path] =
            /* @__PURE__ */ Object.create(null);
        }
        this.idx[cookie.domain][cookie.path][cookie.key] = cookie;
        cb(null);
      }
      updateCookie(oldCookie, newCookie, cb) {
        this.putCookie(newCookie, cb);
      }
      removeCookie(domain2, path, key, cb) {
        if (
          this.idx[domain2] &&
          this.idx[domain2][path] &&
          this.idx[domain2][path][key]
        ) {
          delete this.idx[domain2][path][key];
        }
        cb(null);
      }
      removeCookies(domain2, path, cb) {
        if (this.idx[domain2]) {
          if (path) {
            delete this.idx[domain2][path];
          } else {
            delete this.idx[domain2];
          }
        }
        return cb(null);
      }
      removeAllCookies(cb) {
        this.idx = /* @__PURE__ */ Object.create(null);
        return cb(null);
      }
      getAllCookies(cb) {
        const cookies = [];
        const idx = this.idx;
        const domains = Object.keys(idx);
        domains.forEach((domain2) => {
          const paths = Object.keys(idx[domain2]);
          paths.forEach((path) => {
            const keys = Object.keys(idx[domain2][path]);
            keys.forEach((key) => {
              if (key !== null) {
                cookies.push(idx[domain2][path][key]);
              }
            });
          });
        });
        cookies.sort((a, b) => {
          return (a.creationIndex || 0) - (b.creationIndex || 0);
        });
        cb(null, cookies);
      }
    };
    [
      'findCookie',
      'findCookies',
      'putCookie',
      'updateCookie',
      'removeCookie',
      'removeCookies',
      'removeAllCookies',
      'getAllCookies',
    ].forEach((name) => {
      MemoryCookieStore.prototype[name] = fromCallback(
        MemoryCookieStore.prototype[name]
      );
    });
    exports.MemoryCookieStore = MemoryCookieStore;
    function inspectFallback(val) {
      const domains = Object.keys(val);
      if (domains.length === 0) {
        return '[Object: null prototype] {}';
      }
      let result = '[Object: null prototype] {\n';
      Object.keys(val).forEach((domain2, i) => {
        result += formatDomain(domain2, val[domain2]);
        if (i < domains.length - 1) {
          result += ',';
        }
        result += '\n';
      });
      result += '}';
      return result;
    }
    __name(inspectFallback, 'inspectFallback');
    function formatDomain(domainName, domainValue) {
      const indent = '  ';
      let result = `${indent}'${domainName}': [Object: null prototype] {
`;
      Object.keys(domainValue).forEach((path, i, paths) => {
        result += formatPath(path, domainValue[path]);
        if (i < paths.length - 1) {
          result += ',';
        }
        result += '\n';
      });
      result += `${indent}}`;
      return result;
    }
    __name(formatDomain, 'formatDomain');
    function formatPath(pathName, pathValue) {
      const indent = '    ';
      let result = `${indent}'${pathName}': [Object: null prototype] {
`;
      Object.keys(pathValue).forEach((cookieName, i, cookieNames) => {
        const cookie = pathValue[cookieName];
        result += `      ${cookieName}: ${cookie.inspect()}`;
        if (i < cookieNames.length - 1) {
          result += ',';
        }
        result += '\n';
      });
      result += `${indent}}`;
      return result;
    }
    __name(formatPath, 'formatPath');
    exports.inspectFallback = inspectFallback;
  },
});

// node_modules/tough-cookie/lib/validators.js
var require_validators = __commonJS({
  'node_modules/tough-cookie/lib/validators.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var toString = Object.prototype.toString;
    function isFunction(data) {
      return typeof data === 'function';
    }
    __name(isFunction, 'isFunction');
    function isNonEmptyString(data) {
      return isString(data) && data !== '';
    }
    __name(isNonEmptyString, 'isNonEmptyString');
    function isDate2(data) {
      return isInstanceStrict(data, Date) && isInteger(data.getTime());
    }
    __name(isDate2, 'isDate');
    function isEmptyString(data) {
      return data === '' || (data instanceof String && data.toString() === '');
    }
    __name(isEmptyString, 'isEmptyString');
    function isString(data) {
      return typeof data === 'string' || data instanceof String;
    }
    __name(isString, 'isString');
    function isObject(data) {
      return toString.call(data) === '[object Object]';
    }
    __name(isObject, 'isObject');
    function isInstanceStrict(data, prototype) {
      try {
        return data instanceof prototype;
      } catch (error3) {
        return false;
      }
    }
    __name(isInstanceStrict, 'isInstanceStrict');
    function isUrlStringOrObject(data) {
      return (
        isNonEmptyString(data) ||
        (isObject(data) &&
          'hostname' in data &&
          'pathname' in data &&
          'protocol' in data) ||
        isInstanceStrict(data, URL)
      );
    }
    __name(isUrlStringOrObject, 'isUrlStringOrObject');
    function isInteger(data) {
      return typeof data === 'number' && data % 1 === 0;
    }
    __name(isInteger, 'isInteger');
    function validate(bool, cb, options3) {
      if (!isFunction(cb)) {
        options3 = cb;
        cb = null;
      }
      if (!isObject(options3)) options3 = { Error: 'Failed Check' };
      if (!bool) {
        if (cb) {
          cb(new ParameterError(options3));
        } else {
          throw new ParameterError(options3);
        }
      }
    }
    __name(validate, 'validate');
    var ParameterError = class extends Error {
      static {
        __name(this, 'ParameterError');
      }
      constructor(...params) {
        super(...params);
      }
    };
    exports.ParameterError = ParameterError;
    exports.isFunction = isFunction;
    exports.isNonEmptyString = isNonEmptyString;
    exports.isDate = isDate2;
    exports.isEmptyString = isEmptyString;
    exports.isString = isString;
    exports.isObject = isObject;
    exports.isUrlStringOrObject = isUrlStringOrObject;
    exports.validate = validate;
  },
});

// node_modules/tough-cookie/lib/version.js
var require_version = __commonJS({
  'node_modules/tough-cookie/lib/version.js'(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = '4.1.4';
  },
});

// node_modules/tough-cookie/lib/cookie.js
var require_cookie = __commonJS({
  'node_modules/tough-cookie/lib/cookie.js'(exports) {
    'use strict';
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var punycode = require_punycode();
    var urlParse = require_url_parse();
    var pubsuffix = require_pubsuffix_psl();
    var Store = require_store().Store;
    var MemoryCookieStore = require_memstore().MemoryCookieStore;
    var pathMatch = require_pathMatch().pathMatch;
    var validators = require_validators();
    var VERSION = require_version();
    var { fromCallback } = require_universalify();
    var { getCustomInspectSymbol } = require_utilHelper();
    var COOKIE_OCTETS = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/;
    var CONTROL_CHARS = /[\x00-\x1F]/;
    var TERMINATORS = ['\n', '\r', '\0'];
    var PATH_VALUE = /[\x20-\x3A\x3C-\x7E]+/;
    var DATE_DELIM = /[\x09\x20-\x2F\x3B-\x40\x5B-\x60\x7B-\x7E]/;
    var MONTH_TO_NUM = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    var MAX_TIME = 2147483647e3;
    var MIN_TIME = 0;
    var SAME_SITE_CONTEXT_VAL_ERR =
      'Invalid sameSiteContext option for getCookies(); expected one of "strict", "lax", or "none"';
    function checkSameSiteContext(value) {
      validators.validate(validators.isNonEmptyString(value), value);
      const context2 = String(value).toLowerCase();
      if (context2 === 'none' || context2 === 'lax' || context2 === 'strict') {
        return context2;
      } else {
        return null;
      }
    }
    __name(checkSameSiteContext, 'checkSameSiteContext');
    var PrefixSecurityEnum = Object.freeze({
      SILENT: 'silent',
      STRICT: 'strict',
      DISABLED: 'unsafe-disabled',
    });
    var IP_REGEX_LOWERCASE =
      /(?:^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$)|(?:^(?:(?:[a-f\d]{1,4}:){7}(?:[a-f\d]{1,4}|:)|(?:[a-f\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|:[a-f\d]{1,4}|:)|(?:[a-f\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,2}|:)|(?:[a-f\d]{1,4}:){4}(?:(?::[a-f\d]{1,4}){0,1}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,3}|:)|(?:[a-f\d]{1,4}:){3}(?:(?::[a-f\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,4}|:)|(?:[a-f\d]{1,4}:){2}(?:(?::[a-f\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,5}|:)|(?:[a-f\d]{1,4}:){1}(?:(?::[a-f\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,6}|:)|(?::(?:(?::[a-f\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-f\d]{1,4}){1,7}|:)))$)/;
    var IP_V6_REGEX = `
\\[?(?:
(?:[a-fA-F\\d]{1,4}:){7}(?:[a-fA-F\\d]{1,4}|:)|
(?:[a-fA-F\\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|:[a-fA-F\\d]{1,4}|:)|
(?:[a-fA-F\\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,2}|:)|
(?:[a-fA-F\\d]{1,4}:){4}(?:(?::[a-fA-F\\d]{1,4}){0,1}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,3}|:)|
(?:[a-fA-F\\d]{1,4}:){3}(?:(?::[a-fA-F\\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,4}|:)|
(?:[a-fA-F\\d]{1,4}:){2}(?:(?::[a-fA-F\\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,5}|:)|
(?:[a-fA-F\\d]{1,4}:){1}(?:(?::[a-fA-F\\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,6}|:)|
(?::(?:(?::[a-fA-F\\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}|(?::[a-fA-F\\d]{1,4}){1,7}|:))
)(?:%[0-9a-zA-Z]{1,})?\\]?
`
      .replace(/\s*\/\/.*$/gm, '')
      .replace(/\n/g, '')
      .trim();
    var IP_V6_REGEX_OBJECT = new RegExp(`^${IP_V6_REGEX}$`);
    function parseDigits(token, minDigits, maxDigits, trailingOK) {
      let count3 = 0;
      while (count3 < token.length) {
        const c = token.charCodeAt(count3);
        if (c <= 47 || c >= 58) {
          break;
        }
        count3++;
      }
      if (count3 < minDigits || count3 > maxDigits) {
        return null;
      }
      if (!trailingOK && count3 != token.length) {
        return null;
      }
      return parseInt(token.substr(0, count3), 10);
    }
    __name(parseDigits, 'parseDigits');
    function parseTime(token) {
      const parts = token.split(':');
      const result = [0, 0, 0];
      if (parts.length !== 3) {
        return null;
      }
      for (let i = 0; i < 3; i++) {
        const trailingOK = i == 2;
        const num = parseDigits(parts[i], 1, 2, trailingOK);
        if (num === null) {
          return null;
        }
        result[i] = num;
      }
      return result;
    }
    __name(parseTime, 'parseTime');
    function parseMonth(token) {
      token = String(token).substr(0, 3).toLowerCase();
      const num = MONTH_TO_NUM[token];
      return num >= 0 ? num : null;
    }
    __name(parseMonth, 'parseMonth');
    function parseDate(str) {
      if (!str) {
        return;
      }
      const tokens = str.split(DATE_DELIM);
      if (!tokens) {
        return;
      }
      let hour = null;
      let minute = null;
      let second = null;
      let dayOfMonth = null;
      let month = null;
      let year = null;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i].trim();
        if (!token.length) {
          continue;
        }
        let result;
        if (second === null) {
          result = parseTime(token);
          if (result) {
            hour = result[0];
            minute = result[1];
            second = result[2];
            continue;
          }
        }
        if (dayOfMonth === null) {
          result = parseDigits(token, 1, 2, true);
          if (result !== null) {
            dayOfMonth = result;
            continue;
          }
        }
        if (month === null) {
          result = parseMonth(token);
          if (result !== null) {
            month = result;
            continue;
          }
        }
        if (year === null) {
          result = parseDigits(token, 2, 4, true);
          if (result !== null) {
            year = result;
            if (year >= 70 && year <= 99) {
              year += 1900;
            } else if (year >= 0 && year <= 69) {
              year += 2e3;
            }
          }
        }
      }
      if (
        dayOfMonth === null ||
        month === null ||
        year === null ||
        second === null ||
        dayOfMonth < 1 ||
        dayOfMonth > 31 ||
        year < 1601 ||
        hour > 23 ||
        minute > 59 ||
        second > 59
      ) {
        return;
      }
      return new Date(Date.UTC(year, month, dayOfMonth, hour, minute, second));
    }
    __name(parseDate, 'parseDate');
    function formatDate(date) {
      validators.validate(validators.isDate(date), date);
      return date.toUTCString();
    }
    __name(formatDate, 'formatDate');
    function canonicalDomain(str) {
      if (str == null) {
        return null;
      }
      str = str.trim().replace(/^\./, '');
      if (IP_V6_REGEX_OBJECT.test(str)) {
        str = str.replace('[', '').replace(']', '');
      }
      if (punycode && /[^\u0001-\u007f]/.test(str)) {
        str = punycode.toASCII(str);
      }
      return str.toLowerCase();
    }
    __name(canonicalDomain, 'canonicalDomain');
    function domainMatch(str, domStr, canonicalize) {
      if (str == null || domStr == null) {
        return null;
      }
      if (canonicalize !== false) {
        str = canonicalDomain(str);
        domStr = canonicalDomain(domStr);
      }
      if (str == domStr) {
        return true;
      }
      const idx = str.lastIndexOf(domStr);
      if (idx <= 0) {
        return false;
      }
      if (str.length !== domStr.length + idx) {
        return false;
      }
      if (str.substr(idx - 1, 1) !== '.') {
        return false;
      }
      if (IP_REGEX_LOWERCASE.test(str)) {
        return false;
      }
      return true;
    }
    __name(domainMatch, 'domainMatch');
    function defaultPath(path) {
      if (!path || path.substr(0, 1) !== '/') {
        return '/';
      }
      if (path === '/') {
        return path;
      }
      const rightSlash = path.lastIndexOf('/');
      if (rightSlash === 0) {
        return '/';
      }
      return path.slice(0, rightSlash);
    }
    __name(defaultPath, 'defaultPath');
    function trimTerminator(str) {
      if (validators.isEmptyString(str)) return str;
      for (let t = 0; t < TERMINATORS.length; t++) {
        const terminatorIdx = str.indexOf(TERMINATORS[t]);
        if (terminatorIdx !== -1) {
          str = str.substr(0, terminatorIdx);
        }
      }
      return str;
    }
    __name(trimTerminator, 'trimTerminator');
    function parseCookiePair(cookiePair, looseMode) {
      cookiePair = trimTerminator(cookiePair);
      validators.validate(validators.isString(cookiePair), cookiePair);
      let firstEq = cookiePair.indexOf('=');
      if (looseMode) {
        if (firstEq === 0) {
          cookiePair = cookiePair.substr(1);
          firstEq = cookiePair.indexOf('=');
        }
      } else {
        if (firstEq <= 0) {
          return;
        }
      }
      let cookieName, cookieValue;
      if (firstEq <= 0) {
        cookieName = '';
        cookieValue = cookiePair.trim();
      } else {
        cookieName = cookiePair.substr(0, firstEq).trim();
        cookieValue = cookiePair.substr(firstEq + 1).trim();
      }
      if (CONTROL_CHARS.test(cookieName) || CONTROL_CHARS.test(cookieValue)) {
        return;
      }
      const c = new Cookie3();
      c.key = cookieName;
      c.value = cookieValue;
      return c;
    }
    __name(parseCookiePair, 'parseCookiePair');
    function parse(str, options3) {
      if (!options3 || typeof options3 !== 'object') {
        options3 = {};
      }
      if (validators.isEmptyString(str) || !validators.isString(str)) {
        return null;
      }
      str = str.trim();
      const firstSemi = str.indexOf(';');
      const cookiePair = firstSemi === -1 ? str : str.substr(0, firstSemi);
      const c = parseCookiePair(cookiePair, !!options3.loose);
      if (!c) {
        return;
      }
      if (firstSemi === -1) {
        return c;
      }
      const unparsed = str.slice(firstSemi + 1).trim();
      if (unparsed.length === 0) {
        return c;
      }
      const cookie_avs = unparsed.split(';');
      while (cookie_avs.length) {
        const av = cookie_avs.shift().trim();
        if (av.length === 0) {
          continue;
        }
        const av_sep = av.indexOf('=');
        let av_key, av_value;
        if (av_sep === -1) {
          av_key = av;
          av_value = null;
        } else {
          av_key = av.substr(0, av_sep);
          av_value = av.substr(av_sep + 1);
        }
        av_key = av_key.trim().toLowerCase();
        if (av_value) {
          av_value = av_value.trim();
        }
        switch (av_key) {
          case 'expires':
            if (av_value) {
              const exp = parseDate(av_value);
              if (exp) {
                c.expires = exp;
              }
            }
            break;
          case 'max-age':
            if (av_value) {
              if (/^-?[0-9]+$/.test(av_value)) {
                const delta = parseInt(av_value, 10);
                c.setMaxAge(delta);
              }
            }
            break;
          case 'domain':
            if (av_value) {
              const domain2 = av_value.trim().replace(/^\./, '');
              if (domain2) {
                c.domain = domain2.toLowerCase();
              }
            }
            break;
          case 'path':
            c.path = av_value && av_value[0] === '/' ? av_value : null;
            break;
          case 'secure':
            c.secure = true;
            break;
          case 'httponly':
            c.httpOnly = true;
            break;
          case 'samesite':
            const enforcement = av_value ? av_value.toLowerCase() : '';
            switch (enforcement) {
              case 'strict':
                c.sameSite = 'strict';
                break;
              case 'lax':
                c.sameSite = 'lax';
                break;
              case 'none':
                c.sameSite = 'none';
                break;
              default:
                c.sameSite = void 0;
                break;
            }
            break;
          default:
            c.extensions = c.extensions || [];
            c.extensions.push(av);
            break;
        }
      }
      return c;
    }
    __name(parse, 'parse');
    function isSecurePrefixConditionMet(cookie) {
      validators.validate(validators.isObject(cookie), cookie);
      return !cookie.key.startsWith('__Secure-') || cookie.secure;
    }
    __name(isSecurePrefixConditionMet, 'isSecurePrefixConditionMet');
    function isHostPrefixConditionMet(cookie) {
      validators.validate(validators.isObject(cookie));
      return (
        !cookie.key.startsWith('__Host-') ||
        (cookie.secure &&
          cookie.hostOnly &&
          cookie.path != null &&
          cookie.path === '/')
      );
    }
    __name(isHostPrefixConditionMet, 'isHostPrefixConditionMet');
    function jsonParse(str) {
      let obj;
      try {
        obj = JSON.parse(str);
      } catch (e) {
        return e;
      }
      return obj;
    }
    __name(jsonParse, 'jsonParse');
    function fromJSON(str) {
      if (!str || validators.isEmptyString(str)) {
        return null;
      }
      let obj;
      if (typeof str === 'string') {
        obj = jsonParse(str);
        if (obj instanceof Error) {
          return null;
        }
      } else {
        obj = str;
      }
      const c = new Cookie3();
      for (let i = 0; i < Cookie3.serializableProperties.length; i++) {
        const prop = Cookie3.serializableProperties[i];
        if (obj[prop] === void 0 || obj[prop] === cookieDefaults[prop]) {
          continue;
        }
        if (
          prop === 'expires' ||
          prop === 'creation' ||
          prop === 'lastAccessed'
        ) {
          if (obj[prop] === null) {
            c[prop] = null;
          } else {
            c[prop] =
              obj[prop] == 'Infinity' ? 'Infinity' : new Date(obj[prop]);
          }
        } else {
          c[prop] = obj[prop];
        }
      }
      return c;
    }
    __name(fromJSON, 'fromJSON');
    function cookieCompare(a, b) {
      validators.validate(validators.isObject(a), a);
      validators.validate(validators.isObject(b), b);
      let cmp = 0;
      const aPathLen = a.path ? a.path.length : 0;
      const bPathLen = b.path ? b.path.length : 0;
      cmp = bPathLen - aPathLen;
      if (cmp !== 0) {
        return cmp;
      }
      const aTime = a.creation ? a.creation.getTime() : MAX_TIME;
      const bTime = b.creation ? b.creation.getTime() : MAX_TIME;
      cmp = aTime - bTime;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = a.creationIndex - b.creationIndex;
      return cmp;
    }
    __name(cookieCompare, 'cookieCompare');
    function permutePath(path) {
      validators.validate(validators.isString(path));
      if (path === '/') {
        return ['/'];
      }
      const permutations = [path];
      while (path.length > 1) {
        const lindex = path.lastIndexOf('/');
        if (lindex === 0) {
          break;
        }
        path = path.substr(0, lindex);
        permutations.push(path);
      }
      permutations.push('/');
      return permutations;
    }
    __name(permutePath, 'permutePath');
    function getCookieContext(url) {
      if (url instanceof Object) {
        return url;
      }
      try {
        url = decodeURI(url);
      } catch (err) {}
      return urlParse(url);
    }
    __name(getCookieContext, 'getCookieContext');
    var cookieDefaults = {
      // the order in which the RFC has them:
      key: '',
      value: '',
      expires: 'Infinity',
      maxAge: null,
      domain: null,
      path: null,
      secure: false,
      httpOnly: false,
      extensions: null,
      // set by the CookieJar:
      hostOnly: null,
      pathIsDefault: null,
      creation: null,
      lastAccessed: null,
      sameSite: void 0,
    };
    var Cookie3 = class _Cookie {
      static {
        __name(this, 'Cookie');
      }
      constructor(options3 = {}) {
        const customInspectSymbol = getCustomInspectSymbol();
        if (customInspectSymbol) {
          this[customInspectSymbol] = this.inspect;
        }
        Object.assign(this, cookieDefaults, options3);
        this.creation = this.creation || /* @__PURE__ */ new Date();
        Object.defineProperty(this, 'creationIndex', {
          configurable: false,
          enumerable: false,
          // important for assert.deepEqual checks
          writable: true,
          value: ++_Cookie.cookiesCreated,
        });
      }
      inspect() {
        const now = Date.now();
        const hostOnly = this.hostOnly != null ? this.hostOnly : '?';
        const createAge = this.creation
          ? `${now - this.creation.getTime()}ms`
          : '?';
        const accessAge = this.lastAccessed
          ? `${now - this.lastAccessed.getTime()}ms`
          : '?';
        return `Cookie="${this.toString()}; hostOnly=${hostOnly}; aAge=${accessAge}; cAge=${createAge}"`;
      }
      toJSON() {
        const obj = {};
        for (const prop of _Cookie.serializableProperties) {
          if (this[prop] === cookieDefaults[prop]) {
            continue;
          }
          if (
            prop === 'expires' ||
            prop === 'creation' ||
            prop === 'lastAccessed'
          ) {
            if (this[prop] === null) {
              obj[prop] = null;
            } else {
              obj[prop] =
                this[prop] == 'Infinity'
                  ? 'Infinity'
                  : this[prop].toISOString();
            }
          } else if (prop === 'maxAge') {
            if (this[prop] !== null) {
              obj[prop] =
                this[prop] == Infinity || this[prop] == -Infinity
                  ? this[prop].toString()
                  : this[prop];
            }
          } else {
            if (this[prop] !== cookieDefaults[prop]) {
              obj[prop] = this[prop];
            }
          }
        }
        return obj;
      }
      clone() {
        return fromJSON(this.toJSON());
      }
      validate() {
        if (!COOKIE_OCTETS.test(this.value)) {
          return false;
        }
        if (
          this.expires != Infinity &&
          !(this.expires instanceof Date) &&
          !parseDate(this.expires)
        ) {
          return false;
        }
        if (this.maxAge != null && this.maxAge <= 0) {
          return false;
        }
        if (this.path != null && !PATH_VALUE.test(this.path)) {
          return false;
        }
        const cdomain = this.cdomain();
        if (cdomain) {
          if (cdomain.match(/\.$/)) {
            return false;
          }
          const suffix = pubsuffix.getPublicSuffix(cdomain);
          if (suffix == null) {
            return false;
          }
        }
        return true;
      }
      setExpires(exp) {
        if (exp instanceof Date) {
          this.expires = exp;
        } else {
          this.expires = parseDate(exp) || 'Infinity';
        }
      }
      setMaxAge(age) {
        if (age === Infinity || age === -Infinity) {
          this.maxAge = age.toString();
        } else {
          this.maxAge = age;
        }
      }
      cookieString() {
        let val = this.value;
        if (val == null) {
          val = '';
        }
        if (this.key === '') {
          return val;
        }
        return `${this.key}=${val}`;
      }
      // gives Set-Cookie header format
      toString() {
        let str = this.cookieString();
        if (this.expires != Infinity) {
          if (this.expires instanceof Date) {
            str += `; Expires=${formatDate(this.expires)}`;
          } else {
            str += `; Expires=${this.expires}`;
          }
        }
        if (this.maxAge != null && this.maxAge != Infinity) {
          str += `; Max-Age=${this.maxAge}`;
        }
        if (this.domain && !this.hostOnly) {
          str += `; Domain=${this.domain}`;
        }
        if (this.path) {
          str += `; Path=${this.path}`;
        }
        if (this.secure) {
          str += '; Secure';
        }
        if (this.httpOnly) {
          str += '; HttpOnly';
        }
        if (this.sameSite && this.sameSite !== 'none') {
          const ssCanon =
            _Cookie.sameSiteCanonical[this.sameSite.toLowerCase()];
          str += `; SameSite=${ssCanon ? ssCanon : this.sameSite}`;
        }
        if (this.extensions) {
          this.extensions.forEach((ext) => {
            str += `; ${ext}`;
          });
        }
        return str;
      }
      // TTL() partially replaces the "expiry-time" parts of S5.3 step 3 (setCookie()
      // elsewhere)
      // S5.3 says to give the "latest representable date" for which we use Infinity
      // For "expired" we use 0
      TTL(now) {
        if (this.maxAge != null) {
          return this.maxAge <= 0 ? 0 : this.maxAge * 1e3;
        }
        let expires = this.expires;
        if (expires != Infinity) {
          if (!(expires instanceof Date)) {
            expires = parseDate(expires) || Infinity;
          }
          if (expires == Infinity) {
            return Infinity;
          }
          return expires.getTime() - (now || Date.now());
        }
        return Infinity;
      }
      // expiryTime() replaces the "expiry-time" parts of S5.3 step 3 (setCookie()
      // elsewhere)
      expiryTime(now) {
        if (this.maxAge != null) {
          const relativeTo = now || this.creation || /* @__PURE__ */ new Date();
          const age = this.maxAge <= 0 ? -Infinity : this.maxAge * 1e3;
          return relativeTo.getTime() + age;
        }
        if (this.expires == Infinity) {
          return Infinity;
        }
        return this.expires.getTime();
      }
      // expiryDate() replaces the "expiry-time" parts of S5.3 step 3 (setCookie()
      // elsewhere), except it returns a Date
      expiryDate(now) {
        const millisec = this.expiryTime(now);
        if (millisec == Infinity) {
          return new Date(MAX_TIME);
        } else if (millisec == -Infinity) {
          return new Date(MIN_TIME);
        } else {
          return new Date(millisec);
        }
      }
      // This replaces the "persistent-flag" parts of S5.3 step 3
      isPersistent() {
        return this.maxAge != null || this.expires != Infinity;
      }
      // Mostly S5.1.2 and S5.2.3:
      canonicalizedDomain() {
        if (this.domain == null) {
          return null;
        }
        return canonicalDomain(this.domain);
      }
      cdomain() {
        return this.canonicalizedDomain();
      }
    };
    Cookie3.cookiesCreated = 0;
    Cookie3.parse = parse;
    Cookie3.fromJSON = fromJSON;
    Cookie3.serializableProperties = Object.keys(cookieDefaults);
    Cookie3.sameSiteLevel = {
      strict: 3,
      lax: 2,
      none: 1,
    };
    Cookie3.sameSiteCanonical = {
      strict: 'Strict',
      lax: 'Lax',
    };
    function getNormalizedPrefixSecurity(prefixSecurity) {
      if (prefixSecurity != null) {
        const normalizedPrefixSecurity = prefixSecurity.toLowerCase();
        switch (normalizedPrefixSecurity) {
          case PrefixSecurityEnum.STRICT:
          case PrefixSecurityEnum.SILENT:
          case PrefixSecurityEnum.DISABLED:
            return normalizedPrefixSecurity;
        }
      }
      return PrefixSecurityEnum.SILENT;
    }
    __name(getNormalizedPrefixSecurity, 'getNormalizedPrefixSecurity');
    var CookieJar2 = class _CookieJar {
      static {
        __name(this, 'CookieJar');
      }
      constructor(store, options3 = { rejectPublicSuffixes: true }) {
        if (typeof options3 === 'boolean') {
          options3 = { rejectPublicSuffixes: options3 };
        }
        validators.validate(validators.isObject(options3), options3);
        this.rejectPublicSuffixes = options3.rejectPublicSuffixes;
        this.enableLooseMode = !!options3.looseMode;
        this.allowSpecialUseDomain =
          typeof options3.allowSpecialUseDomain === 'boolean'
            ? options3.allowSpecialUseDomain
            : true;
        this.store = store || new MemoryCookieStore();
        this.prefixSecurity = getNormalizedPrefixSecurity(
          options3.prefixSecurity
        );
        this._cloneSync = syncWrap('clone');
        this._importCookiesSync = syncWrap('_importCookies');
        this.getCookiesSync = syncWrap('getCookies');
        this.getCookieStringSync = syncWrap('getCookieString');
        this.getSetCookieStringsSync = syncWrap('getSetCookieStrings');
        this.removeAllCookiesSync = syncWrap('removeAllCookies');
        this.setCookieSync = syncWrap('setCookie');
        this.serializeSync = syncWrap('serialize');
      }
      setCookie(cookie, url, options3, cb) {
        validators.validate(validators.isUrlStringOrObject(url), cb, options3);
        let err;
        if (validators.isFunction(url)) {
          cb = url;
          return cb(new Error('No URL was specified'));
        }
        const context2 = getCookieContext(url);
        if (validators.isFunction(options3)) {
          cb = options3;
          options3 = {};
        }
        validators.validate(validators.isFunction(cb), cb);
        if (
          !validators.isNonEmptyString(cookie) &&
          !validators.isObject(cookie) &&
          cookie instanceof String &&
          cookie.length == 0
        ) {
          return cb(null);
        }
        const host = canonicalDomain(context2.hostname);
        const loose = options3.loose || this.enableLooseMode;
        let sameSiteContext = null;
        if (options3.sameSiteContext) {
          sameSiteContext = checkSameSiteContext(options3.sameSiteContext);
          if (!sameSiteContext) {
            return cb(new Error(SAME_SITE_CONTEXT_VAL_ERR));
          }
        }
        if (typeof cookie === 'string' || cookie instanceof String) {
          cookie = Cookie3.parse(cookie, { loose });
          if (!cookie) {
            err = new Error('Cookie failed to parse');
            return cb(options3.ignoreError ? null : err);
          }
        } else if (!(cookie instanceof Cookie3)) {
          err = new Error(
            'First argument to setCookie must be a Cookie object or string'
          );
          return cb(options3.ignoreError ? null : err);
        }
        const now = options3.now || /* @__PURE__ */ new Date();
        if (this.rejectPublicSuffixes && cookie.domain) {
          const suffix = pubsuffix.getPublicSuffix(cookie.cdomain(), {
            allowSpecialUseDomain: this.allowSpecialUseDomain,
            ignoreError: options3.ignoreError,
          });
          if (suffix == null && !IP_V6_REGEX_OBJECT.test(cookie.domain)) {
            err = new Error('Cookie has domain set to a public suffix');
            return cb(options3.ignoreError ? null : err);
          }
        }
        if (cookie.domain) {
          if (!domainMatch(host, cookie.cdomain(), false)) {
            err = new Error(
              `Cookie not in this host's domain. Cookie:${cookie.cdomain()} Request:${host}`
            );
            return cb(options3.ignoreError ? null : err);
          }
          if (cookie.hostOnly == null) {
            cookie.hostOnly = false;
          }
        } else {
          cookie.hostOnly = true;
          cookie.domain = host;
        }
        if (!cookie.path || cookie.path[0] !== '/') {
          cookie.path = defaultPath(context2.pathname);
          cookie.pathIsDefault = true;
        }
        if (options3.http === false && cookie.httpOnly) {
          err = new Error("Cookie is HttpOnly and this isn't an HTTP API");
          return cb(options3.ignoreError ? null : err);
        }
        if (
          cookie.sameSite !== 'none' &&
          cookie.sameSite !== void 0 &&
          sameSiteContext
        ) {
          if (sameSiteContext === 'none') {
            err = new Error(
              'Cookie is SameSite but this is a cross-origin request'
            );
            return cb(options3.ignoreError ? null : err);
          }
        }
        const ignoreErrorForPrefixSecurity =
          this.prefixSecurity === PrefixSecurityEnum.SILENT;
        const prefixSecurityDisabled =
          this.prefixSecurity === PrefixSecurityEnum.DISABLED;
        if (!prefixSecurityDisabled) {
          let errorFound = false;
          let errorMsg;
          if (!isSecurePrefixConditionMet(cookie)) {
            errorFound = true;
            errorMsg =
              'Cookie has __Secure prefix but Secure attribute is not set';
          } else if (!isHostPrefixConditionMet(cookie)) {
            errorFound = true;
            errorMsg =
              "Cookie has __Host prefix but either Secure or HostOnly attribute is not set or Path is not '/'";
          }
          if (errorFound) {
            return cb(
              options3.ignoreError || ignoreErrorForPrefixSecurity
                ? null
                : new Error(errorMsg)
            );
          }
        }
        const store = this.store;
        if (!store.updateCookie) {
          store.updateCookie = function (oldCookie, newCookie, cb2) {
            this.putCookie(newCookie, cb2);
          };
        }
        function withCookie(err2, oldCookie) {
          if (err2) {
            return cb(err2);
          }
          const next = /* @__PURE__ */ __name(function (err3) {
            if (err3) {
              return cb(err3);
            } else {
              cb(null, cookie);
            }
          }, 'next');
          if (oldCookie) {
            if (options3.http === false && oldCookie.httpOnly) {
              err2 = new Error(
                "old Cookie is HttpOnly and this isn't an HTTP API"
              );
              return cb(options3.ignoreError ? null : err2);
            }
            cookie.creation = oldCookie.creation;
            cookie.creationIndex = oldCookie.creationIndex;
            cookie.lastAccessed = now;
            store.updateCookie(oldCookie, cookie, next);
          } else {
            cookie.creation = cookie.lastAccessed = now;
            store.putCookie(cookie, next);
          }
        }
        __name(withCookie, 'withCookie');
        store.findCookie(cookie.domain, cookie.path, cookie.key, withCookie);
      }
      // RFC6365 S5.4
      getCookies(url, options3, cb) {
        validators.validate(validators.isUrlStringOrObject(url), cb, url);
        const context2 = getCookieContext(url);
        if (validators.isFunction(options3)) {
          cb = options3;
          options3 = {};
        }
        validators.validate(validators.isObject(options3), cb, options3);
        validators.validate(validators.isFunction(cb), cb);
        const host = canonicalDomain(context2.hostname);
        const path = context2.pathname || '/';
        let secure = options3.secure;
        if (
          secure == null &&
          context2.protocol &&
          (context2.protocol == 'https:' || context2.protocol == 'wss:')
        ) {
          secure = true;
        }
        let sameSiteLevel = 0;
        if (options3.sameSiteContext) {
          const sameSiteContext = checkSameSiteContext(
            options3.sameSiteContext
          );
          sameSiteLevel = Cookie3.sameSiteLevel[sameSiteContext];
          if (!sameSiteLevel) {
            return cb(new Error(SAME_SITE_CONTEXT_VAL_ERR));
          }
        }
        let http = options3.http;
        if (http == null) {
          http = true;
        }
        const now = options3.now || Date.now();
        const expireCheck = options3.expire !== false;
        const allPaths = !!options3.allPaths;
        const store = this.store;
        function matchingCookie(c) {
          if (c.hostOnly) {
            if (c.domain != host) {
              return false;
            }
          } else {
            if (!domainMatch(host, c.domain, false)) {
              return false;
            }
          }
          if (!allPaths && !pathMatch(path, c.path)) {
            return false;
          }
          if (c.secure && !secure) {
            return false;
          }
          if (c.httpOnly && !http) {
            return false;
          }
          if (sameSiteLevel) {
            const cookieLevel = Cookie3.sameSiteLevel[c.sameSite || 'none'];
            if (cookieLevel > sameSiteLevel) {
              return false;
            }
          }
          if (expireCheck && c.expiryTime() <= now) {
            store.removeCookie(c.domain, c.path, c.key, () => {});
            return false;
          }
          return true;
        }
        __name(matchingCookie, 'matchingCookie');
        store.findCookies(
          host,
          allPaths ? null : path,
          this.allowSpecialUseDomain,
          (err, cookies) => {
            if (err) {
              return cb(err);
            }
            cookies = cookies.filter(matchingCookie);
            if (options3.sort !== false) {
              cookies = cookies.sort(cookieCompare);
            }
            const now2 = /* @__PURE__ */ new Date();
            for (const cookie of cookies) {
              cookie.lastAccessed = now2;
            }
            cb(null, cookies);
          }
        );
      }
      getCookieString(...args) {
        const cb = args.pop();
        validators.validate(validators.isFunction(cb), cb);
        const next = /* @__PURE__ */ __name(function (err, cookies) {
          if (err) {
            cb(err);
          } else {
            cb(
              null,
              cookies
                .sort(cookieCompare)
                .map((c) => c.cookieString())
                .join('; ')
            );
          }
        }, 'next');
        args.push(next);
        this.getCookies.apply(this, args);
      }
      getSetCookieStrings(...args) {
        const cb = args.pop();
        validators.validate(validators.isFunction(cb), cb);
        const next = /* @__PURE__ */ __name(function (err, cookies) {
          if (err) {
            cb(err);
          } else {
            cb(
              null,
              cookies.map((c) => {
                return c.toString();
              })
            );
          }
        }, 'next');
        args.push(next);
        this.getCookies.apply(this, args);
      }
      serialize(cb) {
        validators.validate(validators.isFunction(cb), cb);
        let type = this.store.constructor.name;
        if (validators.isObject(type)) {
          type = null;
        }
        const serialized = {
          // The version of tough-cookie that serialized this jar. Generally a good
          // practice since future versions can make data import decisions based on
          // known past behavior. When/if this matters, use `semver`.
          version: `tough-cookie@${VERSION}`,
          // add the store type, to make humans happy:
          storeType: type,
          // CookieJar configuration:
          rejectPublicSuffixes: !!this.rejectPublicSuffixes,
          enableLooseMode: !!this.enableLooseMode,
          allowSpecialUseDomain: !!this.allowSpecialUseDomain,
          prefixSecurity: getNormalizedPrefixSecurity(this.prefixSecurity),
          // this gets filled from getAllCookies:
          cookies: [],
        };
        if (
          !(
            this.store.getAllCookies &&
            typeof this.store.getAllCookies === 'function'
          )
        ) {
          return cb(
            new Error(
              'store does not support getAllCookies and cannot be serialized'
            )
          );
        }
        this.store.getAllCookies((err, cookies) => {
          if (err) {
            return cb(err);
          }
          serialized.cookies = cookies.map((cookie) => {
            cookie = cookie instanceof Cookie3 ? cookie.toJSON() : cookie;
            delete cookie.creationIndex;
            return cookie;
          });
          return cb(null, serialized);
        });
      }
      toJSON() {
        return this.serializeSync();
      }
      // use the class method CookieJar.deserialize instead of calling this directly
      _importCookies(serialized, cb) {
        let cookies = serialized.cookies;
        if (!cookies || !Array.isArray(cookies)) {
          return cb(new Error('serialized jar has no cookies array'));
        }
        cookies = cookies.slice();
        const putNext = /* @__PURE__ */ __name((err) => {
          if (err) {
            return cb(err);
          }
          if (!cookies.length) {
            return cb(err, this);
          }
          let cookie;
          try {
            cookie = fromJSON(cookies.shift());
          } catch (e) {
            return cb(e);
          }
          if (cookie === null) {
            return putNext(null);
          }
          this.store.putCookie(cookie, putNext);
        }, 'putNext');
        putNext();
      }
      clone(newStore, cb) {
        if (arguments.length === 1) {
          cb = newStore;
          newStore = null;
        }
        this.serialize((err, serialized) => {
          if (err) {
            return cb(err);
          }
          _CookieJar.deserialize(serialized, newStore, cb);
        });
      }
      cloneSync(newStore) {
        if (arguments.length === 0) {
          return this._cloneSync();
        }
        if (!newStore.synchronous) {
          throw new Error(
            'CookieJar clone destination store is not synchronous; use async API instead.'
          );
        }
        return this._cloneSync(newStore);
      }
      removeAllCookies(cb) {
        validators.validate(validators.isFunction(cb), cb);
        const store = this.store;
        if (
          typeof store.removeAllCookies === 'function' &&
          store.removeAllCookies !== Store.prototype.removeAllCookies
        ) {
          return store.removeAllCookies(cb);
        }
        store.getAllCookies((err, cookies) => {
          if (err) {
            return cb(err);
          }
          if (cookies.length === 0) {
            return cb(null);
          }
          let completedCount = 0;
          const removeErrors = [];
          function removeCookieCb(removeErr) {
            if (removeErr) {
              removeErrors.push(removeErr);
            }
            completedCount++;
            if (completedCount === cookies.length) {
              return cb(removeErrors.length ? removeErrors[0] : null);
            }
          }
          __name(removeCookieCb, 'removeCookieCb');
          cookies.forEach((cookie) => {
            store.removeCookie(
              cookie.domain,
              cookie.path,
              cookie.key,
              removeCookieCb
            );
          });
        });
      }
      static deserialize(strOrObj, store, cb) {
        if (arguments.length !== 3) {
          cb = store;
          store = null;
        }
        validators.validate(validators.isFunction(cb), cb);
        let serialized;
        if (typeof strOrObj === 'string') {
          serialized = jsonParse(strOrObj);
          if (serialized instanceof Error) {
            return cb(serialized);
          }
        } else {
          serialized = strOrObj;
        }
        const jar = new _CookieJar(store, {
          rejectPublicSuffixes: serialized.rejectPublicSuffixes,
          looseMode: serialized.enableLooseMode,
          allowSpecialUseDomain: serialized.allowSpecialUseDomain,
          prefixSecurity: serialized.prefixSecurity,
        });
        jar._importCookies(serialized, (err) => {
          if (err) {
            return cb(err);
          }
          cb(null, jar);
        });
      }
      static deserializeSync(strOrObj, store) {
        const serialized =
          typeof strOrObj === 'string' ? JSON.parse(strOrObj) : strOrObj;
        const jar = new _CookieJar(store, {
          rejectPublicSuffixes: serialized.rejectPublicSuffixes,
          looseMode: serialized.enableLooseMode,
        });
        if (!jar.store.synchronous) {
          throw new Error(
            'CookieJar store is not synchronous; use async API instead.'
          );
        }
        jar._importCookiesSync(serialized);
        return jar;
      }
    };
    CookieJar2.fromJSON = CookieJar2.deserializeSync;
    [
      '_importCookies',
      'clone',
      'getCookies',
      'getCookieString',
      'getSetCookieStrings',
      'removeAllCookies',
      'serialize',
      'setCookie',
    ].forEach((name) => {
      CookieJar2.prototype[name] = fromCallback(CookieJar2.prototype[name]);
    });
    CookieJar2.deserialize = fromCallback(CookieJar2.deserialize);
    function syncWrap(method) {
      return function (...args) {
        if (!this.store.synchronous) {
          throw new Error(
            'CookieJar store is not synchronous; use async API instead.'
          );
        }
        let syncErr, syncResult;
        this[method](...args, (err, result) => {
          syncErr = err;
          syncResult = result;
        });
        if (syncErr) {
          throw syncErr;
        }
        return syncResult;
      };
    }
    __name(syncWrap, 'syncWrap');
    exports.version = VERSION;
    exports.CookieJar = CookieJar2;
    exports.Cookie = Cookie3;
    exports.Store = Store;
    exports.MemoryCookieStore = MemoryCookieStore;
    exports.parseDate = parseDate;
    exports.formatDate = formatDate;
    exports.parse = parse;
    exports.fromJSON = fromJSON;
    exports.domainMatch = domainMatch;
    exports.defaultPath = defaultPath;
    exports.pathMatch = pathMatch;
    exports.getPublicSuffix = pubsuffix.getPublicSuffix;
    exports.cookieCompare = cookieCompare;
    exports.permuteDomain = require_permuteDomain().permuteDomain;
    exports.permutePath = permutePath;
    exports.canonicalDomain = canonicalDomain;
    exports.PrefixSecurityEnum = PrefixSecurityEnum;
    exports.ParameterError = validators.ParameterError;
  },
});

// .wrangler/tmp/bundle-SOyyoz/middleware-loader.entry.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// .wrangler/tmp/bundle-SOyyoz/middleware-insertion-facade.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/index.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/index-node.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/index-common.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/yahooFinanceFetch.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/queue.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/clone/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/clone/type.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/clone/value.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/guard/value.mjs
var value_exports = {};
__export(value_exports, {
  IsArray: () => IsArray,
  IsAsyncIterator: () => IsAsyncIterator,
  IsBigInt: () => IsBigInt,
  IsBoolean: () => IsBoolean,
  IsDate: () => IsDate,
  IsFunction: () => IsFunction,
  IsIterator: () => IsIterator,
  IsNull: () => IsNull,
  IsNumber: () => IsNumber,
  IsObject: () => IsObject,
  IsRegExp: () => IsRegExp,
  IsString: () => IsString,
  IsSymbol: () => IsSymbol,
  IsUint8Array: () => IsUint8Array,
  IsUndefined: () => IsUndefined,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function IsAsyncIterator(value) {
  return (
    IsObject(value) &&
    !IsArray(value) &&
    !IsUint8Array(value) &&
    Symbol.asyncIterator in value
  );
}
__name(IsAsyncIterator, 'IsAsyncIterator');
function IsArray(value) {
  return Array.isArray(value);
}
__name(IsArray, 'IsArray');
function IsBigInt(value) {
  return typeof value === 'bigint';
}
__name(IsBigInt, 'IsBigInt');
function IsBoolean(value) {
  return typeof value === 'boolean';
}
__name(IsBoolean, 'IsBoolean');
function IsDate(value) {
  return value instanceof globalThis.Date;
}
__name(IsDate, 'IsDate');
function IsFunction(value) {
  return typeof value === 'function';
}
__name(IsFunction, 'IsFunction');
function IsIterator(value) {
  return (
    IsObject(value) &&
    !IsArray(value) &&
    !IsUint8Array(value) &&
    Symbol.iterator in value
  );
}
__name(IsIterator, 'IsIterator');
function IsNull(value) {
  return value === null;
}
__name(IsNull, 'IsNull');
function IsNumber(value) {
  return typeof value === 'number';
}
__name(IsNumber, 'IsNumber');
function IsObject(value) {
  return typeof value === 'object' && value !== null;
}
__name(IsObject, 'IsObject');
function IsRegExp(value) {
  return value instanceof globalThis.RegExp;
}
__name(IsRegExp, 'IsRegExp');
function IsString(value) {
  return typeof value === 'string';
}
__name(IsString, 'IsString');
function IsSymbol(value) {
  return typeof value === 'symbol';
}
__name(IsSymbol, 'IsSymbol');
function IsUint8Array(value) {
  return value instanceof globalThis.Uint8Array;
}
__name(IsUint8Array, 'IsUint8Array');
function IsUndefined(value) {
  return value === void 0;
}
__name(IsUndefined, 'IsUndefined');

// node_modules/@sinclair/typebox/build/esm/type/clone/value.mjs
function ArrayType(value) {
  return value.map((value2) => Visit(value2));
}
__name(ArrayType, 'ArrayType');
function DateType(value) {
  return new Date(value.getTime());
}
__name(DateType, 'DateType');
function Uint8ArrayType(value) {
  return new Uint8Array(value);
}
__name(Uint8ArrayType, 'Uint8ArrayType');
function RegExpType(value) {
  return new RegExp(value.source, value.flags);
}
__name(RegExpType, 'RegExpType');
function ObjectType(value) {
  const result = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    result[key] = Visit(value[key]);
  }
  for (const key of Object.getOwnPropertySymbols(value)) {
    result[key] = Visit(value[key]);
  }
  return result;
}
__name(ObjectType, 'ObjectType');
function Visit(value) {
  return IsArray(value)
    ? ArrayType(value)
    : IsDate(value)
      ? DateType(value)
      : IsUint8Array(value)
        ? Uint8ArrayType(value)
        : IsRegExp(value)
          ? RegExpType(value)
          : IsObject(value)
            ? ObjectType(value)
            : value;
}
__name(Visit, 'Visit');
function Clone(value) {
  return Visit(value);
}
__name(Clone, 'Clone');

// node_modules/@sinclair/typebox/build/esm/type/clone/type.mjs
function CloneRest(schemas) {
  return schemas.map((schema) => CloneType(schema));
}
__name(CloneRest, 'CloneRest');
function CloneType(schema, options3 = {}) {
  return { ...Clone(schema), ...options3 };
}
__name(CloneType, 'CloneType');

// node_modules/@sinclair/typebox/build/esm/type/error/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/error/error.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TypeBoxError = class extends Error {
  static {
    __name(this, 'TypeBoxError');
  }
  constructor(message) {
    super(message);
  }
};

// node_modules/@sinclair/typebox/build/esm/type/guard/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/guard/kind.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/symbols/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/symbols/symbols.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TransformKind = Symbol.for('TypeBox.Transform');
var ReadonlyKind = Symbol.for('TypeBox.Readonly');
var OptionalKind = Symbol.for('TypeBox.Optional');
var Hint = Symbol.for('TypeBox.Hint');
var Kind = Symbol.for('TypeBox.Kind');

// node_modules/@sinclair/typebox/build/esm/type/guard/kind.mjs
function IsReadonly(value) {
  return IsObject(value) && value[ReadonlyKind] === 'Readonly';
}
__name(IsReadonly, 'IsReadonly');
function IsOptional(value) {
  return IsObject(value) && value[OptionalKind] === 'Optional';
}
__name(IsOptional, 'IsOptional');
function IsAny(value) {
  return IsKindOf(value, 'Any');
}
__name(IsAny, 'IsAny');
function IsArray2(value) {
  return IsKindOf(value, 'Array');
}
__name(IsArray2, 'IsArray');
function IsAsyncIterator2(value) {
  return IsKindOf(value, 'AsyncIterator');
}
__name(IsAsyncIterator2, 'IsAsyncIterator');
function IsBigInt2(value) {
  return IsKindOf(value, 'BigInt');
}
__name(IsBigInt2, 'IsBigInt');
function IsBoolean2(value) {
  return IsKindOf(value, 'Boolean');
}
__name(IsBoolean2, 'IsBoolean');
function IsConstructor(value) {
  return IsKindOf(value, 'Constructor');
}
__name(IsConstructor, 'IsConstructor');
function IsDate2(value) {
  return IsKindOf(value, 'Date');
}
__name(IsDate2, 'IsDate');
function IsFunction2(value) {
  return IsKindOf(value, 'Function');
}
__name(IsFunction2, 'IsFunction');
function IsInteger(value) {
  return IsKindOf(value, 'Integer');
}
__name(IsInteger, 'IsInteger');
function IsIntersect(value) {
  return IsKindOf(value, 'Intersect');
}
__name(IsIntersect, 'IsIntersect');
function IsIterator2(value) {
  return IsKindOf(value, 'Iterator');
}
__name(IsIterator2, 'IsIterator');
function IsKindOf(value, kind) {
  return IsObject(value) && Kind in value && value[Kind] === kind;
}
__name(IsKindOf, 'IsKindOf');
function IsLiteral(value) {
  return IsKindOf(value, 'Literal');
}
__name(IsLiteral, 'IsLiteral');
function IsMappedKey(value) {
  return IsKindOf(value, 'MappedKey');
}
__name(IsMappedKey, 'IsMappedKey');
function IsMappedResult(value) {
  return IsKindOf(value, 'MappedResult');
}
__name(IsMappedResult, 'IsMappedResult');
function IsNever(value) {
  return IsKindOf(value, 'Never');
}
__name(IsNever, 'IsNever');
function IsNot(value) {
  return IsKindOf(value, 'Not');
}
__name(IsNot, 'IsNot');
function IsNull2(value) {
  return IsKindOf(value, 'Null');
}
__name(IsNull2, 'IsNull');
function IsNumber2(value) {
  return IsKindOf(value, 'Number');
}
__name(IsNumber2, 'IsNumber');
function IsObject2(value) {
  return IsKindOf(value, 'Object');
}
__name(IsObject2, 'IsObject');
function IsPromise(value) {
  return IsKindOf(value, 'Promise');
}
__name(IsPromise, 'IsPromise');
function IsRecord(value) {
  return IsKindOf(value, 'Record');
}
__name(IsRecord, 'IsRecord');
function IsRef(value) {
  return IsKindOf(value, 'Ref');
}
__name(IsRef, 'IsRef');
function IsRegExp2(value) {
  return IsKindOf(value, 'RegExp');
}
__name(IsRegExp2, 'IsRegExp');
function IsString2(value) {
  return IsKindOf(value, 'String');
}
__name(IsString2, 'IsString');
function IsSymbol2(value) {
  return IsKindOf(value, 'Symbol');
}
__name(IsSymbol2, 'IsSymbol');
function IsTemplateLiteral(value) {
  return IsKindOf(value, 'TemplateLiteral');
}
__name(IsTemplateLiteral, 'IsTemplateLiteral');
function IsThis(value) {
  return IsKindOf(value, 'This');
}
__name(IsThis, 'IsThis');
function IsTransform(value) {
  return IsObject(value) && TransformKind in value;
}
__name(IsTransform, 'IsTransform');
function IsTuple(value) {
  return IsKindOf(value, 'Tuple');
}
__name(IsTuple, 'IsTuple');
function IsUndefined2(value) {
  return IsKindOf(value, 'Undefined');
}
__name(IsUndefined2, 'IsUndefined');
function IsUnion(value) {
  return IsKindOf(value, 'Union');
}
__name(IsUnion, 'IsUnion');
function IsUint8Array2(value) {
  return IsKindOf(value, 'Uint8Array');
}
__name(IsUint8Array2, 'IsUint8Array');
function IsUnknown(value) {
  return IsKindOf(value, 'Unknown');
}
__name(IsUnknown, 'IsUnknown');
function IsUnsafe(value) {
  return IsKindOf(value, 'Unsafe');
}
__name(IsUnsafe, 'IsUnsafe');
function IsVoid(value) {
  return IsKindOf(value, 'Void');
}
__name(IsVoid, 'IsVoid');
function IsKind(value) {
  return IsObject(value) && Kind in value && IsString(value[Kind]);
}
__name(IsKind, 'IsKind');
function IsSchema(value) {
  return (
    IsAny(value) ||
    IsArray2(value) ||
    IsBoolean2(value) ||
    IsBigInt2(value) ||
    IsAsyncIterator2(value) ||
    IsConstructor(value) ||
    IsDate2(value) ||
    IsFunction2(value) ||
    IsInteger(value) ||
    IsIntersect(value) ||
    IsIterator2(value) ||
    IsLiteral(value) ||
    IsMappedKey(value) ||
    IsMappedResult(value) ||
    IsNever(value) ||
    IsNot(value) ||
    IsNull2(value) ||
    IsNumber2(value) ||
    IsObject2(value) ||
    IsPromise(value) ||
    IsRecord(value) ||
    IsRef(value) ||
    IsRegExp2(value) ||
    IsString2(value) ||
    IsSymbol2(value) ||
    IsTemplateLiteral(value) ||
    IsThis(value) ||
    IsTuple(value) ||
    IsUndefined2(value) ||
    IsUnion(value) ||
    IsUint8Array2(value) ||
    IsUnknown(value) ||
    IsUnsafe(value) ||
    IsVoid(value) ||
    IsKind(value)
  );
}
__name(IsSchema, 'IsSchema');

// node_modules/@sinclair/typebox/build/esm/type/guard/type.mjs
var type_exports = {};
__export(type_exports, {
  IsAny: () => IsAny2,
  IsArray: () => IsArray3,
  IsAsyncIterator: () => IsAsyncIterator3,
  IsBigInt: () => IsBigInt3,
  IsBoolean: () => IsBoolean3,
  IsConstructor: () => IsConstructor2,
  IsDate: () => IsDate3,
  IsFunction: () => IsFunction3,
  IsInteger: () => IsInteger2,
  IsIntersect: () => IsIntersect2,
  IsIterator: () => IsIterator3,
  IsKind: () => IsKind2,
  IsKindOf: () => IsKindOf2,
  IsLiteral: () => IsLiteral2,
  IsLiteralBoolean: () => IsLiteralBoolean,
  IsLiteralNumber: () => IsLiteralNumber,
  IsLiteralString: () => IsLiteralString,
  IsLiteralValue: () => IsLiteralValue,
  IsMappedKey: () => IsMappedKey2,
  IsMappedResult: () => IsMappedResult2,
  IsNever: () => IsNever2,
  IsNot: () => IsNot2,
  IsNull: () => IsNull3,
  IsNumber: () => IsNumber3,
  IsObject: () => IsObject3,
  IsOptional: () => IsOptional2,
  IsPromise: () => IsPromise2,
  IsProperties: () => IsProperties,
  IsReadonly: () => IsReadonly2,
  IsRecord: () => IsRecord2,
  IsRecursive: () => IsRecursive,
  IsRef: () => IsRef2,
  IsRegExp: () => IsRegExp3,
  IsSchema: () => IsSchema2,
  IsString: () => IsString3,
  IsSymbol: () => IsSymbol3,
  IsTemplateLiteral: () => IsTemplateLiteral2,
  IsThis: () => IsThis2,
  IsTransform: () => IsTransform2,
  IsTuple: () => IsTuple2,
  IsUint8Array: () => IsUint8Array3,
  IsUndefined: () => IsUndefined3,
  IsUnion: () => IsUnion2,
  IsUnionLiteral: () => IsUnionLiteral,
  IsUnknown: () => IsUnknown2,
  IsUnsafe: () => IsUnsafe2,
  IsVoid: () => IsVoid2,
  TypeGuardUnknownTypeError: () => TypeGuardUnknownTypeError,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TypeGuardUnknownTypeError = class extends TypeBoxError {
  static {
    __name(this, 'TypeGuardUnknownTypeError');
  }
};
var KnownTypes = [
  'Any',
  'Array',
  'AsyncIterator',
  'BigInt',
  'Boolean',
  'Constructor',
  'Date',
  'Enum',
  'Function',
  'Integer',
  'Intersect',
  'Iterator',
  'Literal',
  'MappedKey',
  'MappedResult',
  'Not',
  'Null',
  'Number',
  'Object',
  'Promise',
  'Record',
  'Ref',
  'RegExp',
  'String',
  'Symbol',
  'TemplateLiteral',
  'This',
  'Tuple',
  'Undefined',
  'Union',
  'Uint8Array',
  'Unknown',
  'Void',
];
function IsPattern(value) {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}
__name(IsPattern, 'IsPattern');
function IsControlCharacterFree(value) {
  if (!IsString(value)) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code >= 7 && code <= 13) || code === 27 || code === 127) {
      return false;
    }
  }
  return true;
}
__name(IsControlCharacterFree, 'IsControlCharacterFree');
function IsAdditionalProperties(value) {
  return IsOptionalBoolean(value) || IsSchema2(value);
}
__name(IsAdditionalProperties, 'IsAdditionalProperties');
function IsOptionalBigInt(value) {
  return IsUndefined(value) || IsBigInt(value);
}
__name(IsOptionalBigInt, 'IsOptionalBigInt');
function IsOptionalNumber(value) {
  return IsUndefined(value) || IsNumber(value);
}
__name(IsOptionalNumber, 'IsOptionalNumber');
function IsOptionalBoolean(value) {
  return IsUndefined(value) || IsBoolean(value);
}
__name(IsOptionalBoolean, 'IsOptionalBoolean');
function IsOptionalString(value) {
  return IsUndefined(value) || IsString(value);
}
__name(IsOptionalString, 'IsOptionalString');
function IsOptionalPattern(value) {
  return (
    IsUndefined(value) ||
    (IsString(value) && IsControlCharacterFree(value) && IsPattern(value))
  );
}
__name(IsOptionalPattern, 'IsOptionalPattern');
function IsOptionalFormat(value) {
  return (
    IsUndefined(value) || (IsString(value) && IsControlCharacterFree(value))
  );
}
__name(IsOptionalFormat, 'IsOptionalFormat');
function IsOptionalSchema(value) {
  return IsUndefined(value) || IsSchema2(value);
}
__name(IsOptionalSchema, 'IsOptionalSchema');
function IsReadonly2(value) {
  return IsObject(value) && value[ReadonlyKind] === 'Readonly';
}
__name(IsReadonly2, 'IsReadonly');
function IsOptional2(value) {
  return IsObject(value) && value[OptionalKind] === 'Optional';
}
__name(IsOptional2, 'IsOptional');
function IsAny2(value) {
  return IsKindOf2(value, 'Any') && IsOptionalString(value.$id);
}
__name(IsAny2, 'IsAny');
function IsArray3(value) {
  return (
    IsKindOf2(value, 'Array') &&
    value.type === 'array' &&
    IsOptionalString(value.$id) &&
    IsSchema2(value.items) &&
    IsOptionalNumber(value.minItems) &&
    IsOptionalNumber(value.maxItems) &&
    IsOptionalBoolean(value.uniqueItems) &&
    IsOptionalSchema(value.contains) &&
    IsOptionalNumber(value.minContains) &&
    IsOptionalNumber(value.maxContains)
  );
}
__name(IsArray3, 'IsArray');
function IsAsyncIterator3(value) {
  return (
    IsKindOf2(value, 'AsyncIterator') &&
    value.type === 'AsyncIterator' &&
    IsOptionalString(value.$id) &&
    IsSchema2(value.items)
  );
}
__name(IsAsyncIterator3, 'IsAsyncIterator');
function IsBigInt3(value) {
  return (
    IsKindOf2(value, 'BigInt') &&
    value.type === 'bigint' &&
    IsOptionalString(value.$id) &&
    IsOptionalBigInt(value.exclusiveMaximum) &&
    IsOptionalBigInt(value.exclusiveMinimum) &&
    IsOptionalBigInt(value.maximum) &&
    IsOptionalBigInt(value.minimum) &&
    IsOptionalBigInt(value.multipleOf)
  );
}
__name(IsBigInt3, 'IsBigInt');
function IsBoolean3(value) {
  return (
    IsKindOf2(value, 'Boolean') &&
    value.type === 'boolean' &&
    IsOptionalString(value.$id)
  );
}
__name(IsBoolean3, 'IsBoolean');
function IsConstructor2(value) {
  return (
    IsKindOf2(value, 'Constructor') &&
    value.type === 'Constructor' &&
    IsOptionalString(value.$id) &&
    IsArray(value.parameters) &&
    value.parameters.every((schema) => IsSchema2(schema)) &&
    IsSchema2(value.returns)
  );
}
__name(IsConstructor2, 'IsConstructor');
function IsDate3(value) {
  return (
    IsKindOf2(value, 'Date') &&
    value.type === 'Date' &&
    IsOptionalString(value.$id) &&
    IsOptionalNumber(value.exclusiveMaximumTimestamp) &&
    IsOptionalNumber(value.exclusiveMinimumTimestamp) &&
    IsOptionalNumber(value.maximumTimestamp) &&
    IsOptionalNumber(value.minimumTimestamp) &&
    IsOptionalNumber(value.multipleOfTimestamp)
  );
}
__name(IsDate3, 'IsDate');
function IsFunction3(value) {
  return (
    IsKindOf2(value, 'Function') &&
    value.type === 'Function' &&
    IsOptionalString(value.$id) &&
    IsArray(value.parameters) &&
    value.parameters.every((schema) => IsSchema2(schema)) &&
    IsSchema2(value.returns)
  );
}
__name(IsFunction3, 'IsFunction');
function IsInteger2(value) {
  return (
    IsKindOf2(value, 'Integer') &&
    value.type === 'integer' &&
    IsOptionalString(value.$id) &&
    IsOptionalNumber(value.exclusiveMaximum) &&
    IsOptionalNumber(value.exclusiveMinimum) &&
    IsOptionalNumber(value.maximum) &&
    IsOptionalNumber(value.minimum) &&
    IsOptionalNumber(value.multipleOf)
  );
}
__name(IsInteger2, 'IsInteger');
function IsProperties(value) {
  return (
    IsObject(value) &&
    Object.entries(value).every(
      ([key, schema]) => IsControlCharacterFree(key) && IsSchema2(schema)
    )
  );
}
__name(IsProperties, 'IsProperties');
function IsIntersect2(value) {
  return (
    IsKindOf2(value, 'Intersect') &&
    (IsString(value.type) && value.type !== 'object' ? false : true) &&
    IsArray(value.allOf) &&
    value.allOf.every((schema) => IsSchema2(schema) && !IsTransform2(schema)) &&
    IsOptionalString(value.type) &&
    (IsOptionalBoolean(value.unevaluatedProperties) ||
      IsOptionalSchema(value.unevaluatedProperties)) &&
    IsOptionalString(value.$id)
  );
}
__name(IsIntersect2, 'IsIntersect');
function IsIterator3(value) {
  return (
    IsKindOf2(value, 'Iterator') &&
    value.type === 'Iterator' &&
    IsOptionalString(value.$id) &&
    IsSchema2(value.items)
  );
}
__name(IsIterator3, 'IsIterator');
function IsKindOf2(value, kind) {
  return IsObject(value) && Kind in value && value[Kind] === kind;
}
__name(IsKindOf2, 'IsKindOf');
function IsLiteralString(value) {
  return IsLiteral2(value) && IsString(value.const);
}
__name(IsLiteralString, 'IsLiteralString');
function IsLiteralNumber(value) {
  return IsLiteral2(value) && IsNumber(value.const);
}
__name(IsLiteralNumber, 'IsLiteralNumber');
function IsLiteralBoolean(value) {
  return IsLiteral2(value) && IsBoolean(value.const);
}
__name(IsLiteralBoolean, 'IsLiteralBoolean');
function IsLiteral2(value) {
  return (
    IsKindOf2(value, 'Literal') &&
    IsOptionalString(value.$id) &&
    IsLiteralValue(value.const)
  );
}
__name(IsLiteral2, 'IsLiteral');
function IsLiteralValue(value) {
  return IsBoolean(value) || IsNumber(value) || IsString(value);
}
__name(IsLiteralValue, 'IsLiteralValue');
function IsMappedKey2(value) {
  return (
    IsKindOf2(value, 'MappedKey') &&
    IsArray(value.keys) &&
    value.keys.every((key) => IsNumber(key) || IsString(key))
  );
}
__name(IsMappedKey2, 'IsMappedKey');
function IsMappedResult2(value) {
  return IsKindOf2(value, 'MappedResult') && IsProperties(value.properties);
}
__name(IsMappedResult2, 'IsMappedResult');
function IsNever2(value) {
  return (
    IsKindOf2(value, 'Never') &&
    IsObject(value.not) &&
    Object.getOwnPropertyNames(value.not).length === 0
  );
}
__name(IsNever2, 'IsNever');
function IsNot2(value) {
  return IsKindOf2(value, 'Not') && IsSchema2(value.not);
}
__name(IsNot2, 'IsNot');
function IsNull3(value) {
  return (
    IsKindOf2(value, 'Null') &&
    value.type === 'null' &&
    IsOptionalString(value.$id)
  );
}
__name(IsNull3, 'IsNull');
function IsNumber3(value) {
  return (
    IsKindOf2(value, 'Number') &&
    value.type === 'number' &&
    IsOptionalString(value.$id) &&
    IsOptionalNumber(value.exclusiveMaximum) &&
    IsOptionalNumber(value.exclusiveMinimum) &&
    IsOptionalNumber(value.maximum) &&
    IsOptionalNumber(value.minimum) &&
    IsOptionalNumber(value.multipleOf)
  );
}
__name(IsNumber3, 'IsNumber');
function IsObject3(value) {
  return (
    IsKindOf2(value, 'Object') &&
    value.type === 'object' &&
    IsOptionalString(value.$id) &&
    IsProperties(value.properties) &&
    IsAdditionalProperties(value.additionalProperties) &&
    IsOptionalNumber(value.minProperties) &&
    IsOptionalNumber(value.maxProperties)
  );
}
__name(IsObject3, 'IsObject');
function IsPromise2(value) {
  return (
    IsKindOf2(value, 'Promise') &&
    value.type === 'Promise' &&
    IsOptionalString(value.$id) &&
    IsSchema2(value.item)
  );
}
__name(IsPromise2, 'IsPromise');
function IsRecord2(value) {
  return (
    IsKindOf2(value, 'Record') &&
    value.type === 'object' &&
    IsOptionalString(value.$id) &&
    IsAdditionalProperties(value.additionalProperties) &&
    IsObject(value.patternProperties) &&
    ((schema) => {
      const keys = Object.getOwnPropertyNames(schema.patternProperties);
      return (
        keys.length === 1 &&
        IsPattern(keys[0]) &&
        IsObject(schema.patternProperties) &&
        IsSchema2(schema.patternProperties[keys[0]])
      );
    })(value)
  );
}
__name(IsRecord2, 'IsRecord');
function IsRecursive(value) {
  return IsObject(value) && Hint in value && value[Hint] === 'Recursive';
}
__name(IsRecursive, 'IsRecursive');
function IsRef2(value) {
  return (
    IsKindOf2(value, 'Ref') &&
    IsOptionalString(value.$id) &&
    IsString(value.$ref)
  );
}
__name(IsRef2, 'IsRef');
function IsRegExp3(value) {
  return (
    IsKindOf2(value, 'RegExp') &&
    IsOptionalString(value.$id) &&
    IsString(value.source) &&
    IsString(value.flags) &&
    IsOptionalNumber(value.maxLength) &&
    IsOptionalNumber(value.minLength)
  );
}
__name(IsRegExp3, 'IsRegExp');
function IsString3(value) {
  return (
    IsKindOf2(value, 'String') &&
    value.type === 'string' &&
    IsOptionalString(value.$id) &&
    IsOptionalNumber(value.minLength) &&
    IsOptionalNumber(value.maxLength) &&
    IsOptionalPattern(value.pattern) &&
    IsOptionalFormat(value.format)
  );
}
__name(IsString3, 'IsString');
function IsSymbol3(value) {
  return (
    IsKindOf2(value, 'Symbol') &&
    value.type === 'symbol' &&
    IsOptionalString(value.$id)
  );
}
__name(IsSymbol3, 'IsSymbol');
function IsTemplateLiteral2(value) {
  return (
    IsKindOf2(value, 'TemplateLiteral') &&
    value.type === 'string' &&
    IsString(value.pattern) &&
    value.pattern[0] === '^' &&
    value.pattern[value.pattern.length - 1] === '$'
  );
}
__name(IsTemplateLiteral2, 'IsTemplateLiteral');
function IsThis2(value) {
  return (
    IsKindOf2(value, 'This') &&
    IsOptionalString(value.$id) &&
    IsString(value.$ref)
  );
}
__name(IsThis2, 'IsThis');
function IsTransform2(value) {
  return IsObject(value) && TransformKind in value;
}
__name(IsTransform2, 'IsTransform');
function IsTuple2(value) {
  return (
    IsKindOf2(value, 'Tuple') &&
    value.type === 'array' &&
    IsOptionalString(value.$id) &&
    IsNumber(value.minItems) &&
    IsNumber(value.maxItems) &&
    value.minItems === value.maxItems && // empty
    ((IsUndefined(value.items) &&
      IsUndefined(value.additionalItems) &&
      value.minItems === 0) ||
      (IsArray(value.items) &&
        value.items.every((schema) => IsSchema2(schema))))
  );
}
__name(IsTuple2, 'IsTuple');
function IsUndefined3(value) {
  return (
    IsKindOf2(value, 'Undefined') &&
    value.type === 'undefined' &&
    IsOptionalString(value.$id)
  );
}
__name(IsUndefined3, 'IsUndefined');
function IsUnionLiteral(value) {
  return (
    IsUnion2(value) &&
    value.anyOf.every(
      (schema) => IsLiteralString(schema) || IsLiteralNumber(schema)
    )
  );
}
__name(IsUnionLiteral, 'IsUnionLiteral');
function IsUnion2(value) {
  return (
    IsKindOf2(value, 'Union') &&
    IsOptionalString(value.$id) &&
    IsObject(value) &&
    IsArray(value.anyOf) &&
    value.anyOf.every((schema) => IsSchema2(schema))
  );
}
__name(IsUnion2, 'IsUnion');
function IsUint8Array3(value) {
  return (
    IsKindOf2(value, 'Uint8Array') &&
    value.type === 'Uint8Array' &&
    IsOptionalString(value.$id) &&
    IsOptionalNumber(value.minByteLength) &&
    IsOptionalNumber(value.maxByteLength)
  );
}
__name(IsUint8Array3, 'IsUint8Array');
function IsUnknown2(value) {
  return IsKindOf2(value, 'Unknown') && IsOptionalString(value.$id);
}
__name(IsUnknown2, 'IsUnknown');
function IsUnsafe2(value) {
  return IsKindOf2(value, 'Unsafe');
}
__name(IsUnsafe2, 'IsUnsafe');
function IsVoid2(value) {
  return (
    IsKindOf2(value, 'Void') &&
    value.type === 'void' &&
    IsOptionalString(value.$id)
  );
}
__name(IsVoid2, 'IsVoid');
function IsKind2(value) {
  return (
    IsObject(value) &&
    Kind in value &&
    IsString(value[Kind]) &&
    !KnownTypes.includes(value[Kind])
  );
}
__name(IsKind2, 'IsKind');
function IsSchema2(value) {
  return (
    IsObject(value) &&
    (IsAny2(value) ||
      IsArray3(value) ||
      IsBoolean3(value) ||
      IsBigInt3(value) ||
      IsAsyncIterator3(value) ||
      IsConstructor2(value) ||
      IsDate3(value) ||
      IsFunction3(value) ||
      IsInteger2(value) ||
      IsIntersect2(value) ||
      IsIterator3(value) ||
      IsLiteral2(value) ||
      IsMappedKey2(value) ||
      IsMappedResult2(value) ||
      IsNever2(value) ||
      IsNot2(value) ||
      IsNull3(value) ||
      IsNumber3(value) ||
      IsObject3(value) ||
      IsPromise2(value) ||
      IsRecord2(value) ||
      IsRef2(value) ||
      IsRegExp3(value) ||
      IsString3(value) ||
      IsSymbol3(value) ||
      IsTemplateLiteral2(value) ||
      IsThis2(value) ||
      IsTuple2(value) ||
      IsUndefined3(value) ||
      IsUnion2(value) ||
      IsUint8Array3(value) ||
      IsUnknown2(value) ||
      IsUnsafe2(value) ||
      IsVoid2(value) ||
      IsKind2(value))
  );
}
__name(IsSchema2, 'IsSchema');

// node_modules/@sinclair/typebox/build/esm/type/helpers/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/helpers/helpers.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/patterns/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/patterns/patterns.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var PatternBoolean = '(true|false)';
var PatternNumber = '(0|[1-9][0-9]*)';
var PatternString = '(.*)';
var PatternNever = '(?!.*)';
var PatternBooleanExact = `^${PatternBoolean}$`;
var PatternNumberExact = `^${PatternNumber}$`;
var PatternStringExact = `^${PatternString}$`;
var PatternNeverExact = `^${PatternNever}$`;

// node_modules/@sinclair/typebox/build/esm/type/registry/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/registry/format.mjs
var format_exports = {};
__export(format_exports, {
  Clear: () => Clear,
  Delete: () => Delete,
  Entries: () => Entries,
  Get: () => Get,
  Has: () => Has,
  Set: () => Set2,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var map = /* @__PURE__ */ new Map();
function Entries() {
  return new Map(map);
}
__name(Entries, 'Entries');
function Clear() {
  return map.clear();
}
__name(Clear, 'Clear');
function Delete(format) {
  return map.delete(format);
}
__name(Delete, 'Delete');
function Has(format) {
  return map.has(format);
}
__name(Has, 'Has');
function Set2(format, func) {
  map.set(format, func);
}
__name(Set2, 'Set');
function Get(format) {
  return map.get(format);
}
__name(Get, 'Get');

// node_modules/@sinclair/typebox/build/esm/type/registry/type.mjs
var type_exports2 = {};
__export(type_exports2, {
  Clear: () => Clear2,
  Delete: () => Delete2,
  Entries: () => Entries2,
  Get: () => Get2,
  Has: () => Has2,
  Set: () => Set3,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var map2 = /* @__PURE__ */ new Map();
function Entries2() {
  return new Map(map2);
}
__name(Entries2, 'Entries');
function Clear2() {
  return map2.clear();
}
__name(Clear2, 'Clear');
function Delete2(kind) {
  return map2.delete(kind);
}
__name(Delete2, 'Delete');
function Has2(kind) {
  return map2.has(kind);
}
__name(Has2, 'Has');
function Set3(kind, func) {
  map2.set(kind, func);
}
__name(Set3, 'Set');
function Get2(kind) {
  return map2.get(kind);
}
__name(Get2, 'Get');

// node_modules/@sinclair/typebox/build/esm/type/sets/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/sets/set.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function SetIncludes(T, S) {
  return T.includes(S);
}
__name(SetIncludes, 'SetIncludes');
function SetDistinct(T) {
  return [...new Set(T)];
}
__name(SetDistinct, 'SetDistinct');
function SetIntersect(T, S) {
  return T.filter((L) => S.includes(L));
}
__name(SetIntersect, 'SetIntersect');
function SetIntersectManyResolve(T, Init) {
  return T.reduce((Acc, L) => {
    return SetIntersect(Acc, L);
  }, Init);
}
__name(SetIntersectManyResolve, 'SetIntersectManyResolve');
function SetIntersectMany(T) {
  return T.length === 1
    ? T[0]
    : T.length > 1
      ? SetIntersectManyResolve(T.slice(1), T[0])
      : [];
}
__name(SetIntersectMany, 'SetIntersectMany');
function SetUnionMany(T) {
  const Acc = [];
  for (const L of T) Acc.push(...L);
  return Acc;
}
__name(SetUnionMany, 'SetUnionMany');

// node_modules/@sinclair/typebox/build/esm/type/any/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/any/any.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Any(options3 = {}) {
  return { ...options3, [Kind]: 'Any' };
}
__name(Any, 'Any');

// node_modules/@sinclair/typebox/build/esm/type/array/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/array/array.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Array2(schema, options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Array',
    type: 'array',
    items: CloneType(schema),
  };
}
__name(Array2, 'Array');

// node_modules/@sinclair/typebox/build/esm/type/async-iterator/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/async-iterator/async-iterator.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function AsyncIterator(items, options3 = {}) {
  return {
    ...options3,
    [Kind]: 'AsyncIterator',
    type: 'AsyncIterator',
    items: CloneType(items),
  };
}
__name(AsyncIterator, 'AsyncIterator');

// node_modules/@sinclair/typebox/build/esm/type/awaited/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/awaited/awaited.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/intersect/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect-evaluated.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/discard/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/discard/discard.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function DiscardKey(value, key) {
  const { [key]: _, ...rest } = value;
  return rest;
}
__name(DiscardKey, 'DiscardKey');
function Discard(value, keys) {
  return keys.reduce((acc, key) => DiscardKey(acc, key), value);
}
__name(Discard, 'Discard');

// node_modules/@sinclair/typebox/build/esm/type/never/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/never/never.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Never(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Never',
    not: {},
  };
}
__name(Never, 'Never');

// node_modules/@sinclair/typebox/build/esm/type/optional/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/optional/optional-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/mapped/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/mapped/mapped-key.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/mapped/mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function MappedResult(properties) {
  return {
    [Kind]: 'MappedResult',
    properties,
  };
}
__name(MappedResult, 'MappedResult');

// node_modules/@sinclair/typebox/build/esm/type/mapped/mapped.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/constructor/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/constructor/constructor.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Constructor(parameters, returns, options3) {
  return {
    ...options3,
    [Kind]: 'Constructor',
    type: 'Constructor',
    parameters: CloneRest(parameters),
    returns: CloneType(returns),
  };
}
__name(Constructor, 'Constructor');

// node_modules/@sinclair/typebox/build/esm/type/function/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/function/function.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Function(parameters, returns, options3) {
  return {
    ...options3,
    [Kind]: 'Function',
    type: 'Function',
    parameters: CloneRest(parameters),
    returns: CloneType(returns),
  };
}
__name(Function, 'Function');

// node_modules/@sinclair/typebox/build/esm/type/indexed/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-from-mapped-key.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/union/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/union/union-evaluated.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/union/union-create.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function UnionCreate(T, options3) {
  return { ...options3, [Kind]: 'Union', anyOf: CloneRest(T) };
}
__name(UnionCreate, 'UnionCreate');

// node_modules/@sinclair/typebox/build/esm/type/union/union-evaluated.mjs
function IsUnionOptional(T) {
  return T.some((L) => IsOptional(L));
}
__name(IsUnionOptional, 'IsUnionOptional');
function RemoveOptionalFromRest(T) {
  return T.map((L) => (IsOptional(L) ? RemoveOptionalFromType(L) : L));
}
__name(RemoveOptionalFromRest, 'RemoveOptionalFromRest');
function RemoveOptionalFromType(T) {
  return Discard(T, [OptionalKind]);
}
__name(RemoveOptionalFromType, 'RemoveOptionalFromType');
function ResolveUnion(T, options3) {
  return IsUnionOptional(T)
    ? Optional(UnionCreate(RemoveOptionalFromRest(T), options3))
    : UnionCreate(RemoveOptionalFromRest(T), options3);
}
__name(ResolveUnion, 'ResolveUnion');
function UnionEvaluated(T, options3 = {}) {
  return T.length === 0
    ? Never(options3)
    : T.length === 1
      ? CloneType(T[0], options3)
      : ResolveUnion(T, options3);
}
__name(UnionEvaluated, 'UnionEvaluated');

// node_modules/@sinclair/typebox/build/esm/type/union/union-type.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/union/union.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Union(T, options3 = {}) {
  return T.length === 0
    ? Never(options3)
    : T.length === 1
      ? CloneType(T[0], options3)
      : UnionCreate(T, options3);
}
__name(Union, 'Union');

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-property-keys.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/template-literal/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/template-literal/finite.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/template-literal/parse.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TemplateLiteralParserError = class extends TypeBoxError {
  static {
    __name(this, 'TemplateLiteralParserError');
  }
};
function Unescape(pattern) {
  return pattern
    .replace(/\\\$/g, '$')
    .replace(/\\\*/g, '*')
    .replace(/\\\^/g, '^')
    .replace(/\\\|/g, '|')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}
__name(Unescape, 'Unescape');
function IsNonEscaped(pattern, index, char) {
  return pattern[index] === char && pattern.charCodeAt(index - 1) !== 92;
}
__name(IsNonEscaped, 'IsNonEscaped');
function IsOpenParen(pattern, index) {
  return IsNonEscaped(pattern, index, '(');
}
__name(IsOpenParen, 'IsOpenParen');
function IsCloseParen(pattern, index) {
  return IsNonEscaped(pattern, index, ')');
}
__name(IsCloseParen, 'IsCloseParen');
function IsSeparator(pattern, index) {
  return IsNonEscaped(pattern, index, '|');
}
__name(IsSeparator, 'IsSeparator');
function IsGroup(pattern) {
  if (!(IsOpenParen(pattern, 0) && IsCloseParen(pattern, pattern.length - 1)))
    return false;
  let count3 = 0;
  for (let index = 0; index < pattern.length; index++) {
    if (IsOpenParen(pattern, index)) count3 += 1;
    if (IsCloseParen(pattern, index)) count3 -= 1;
    if (count3 === 0 && index !== pattern.length - 1) return false;
  }
  return true;
}
__name(IsGroup, 'IsGroup');
function InGroup(pattern) {
  return pattern.slice(1, pattern.length - 1);
}
__name(InGroup, 'InGroup');
function IsPrecedenceOr(pattern) {
  let count3 = 0;
  for (let index = 0; index < pattern.length; index++) {
    if (IsOpenParen(pattern, index)) count3 += 1;
    if (IsCloseParen(pattern, index)) count3 -= 1;
    if (IsSeparator(pattern, index) && count3 === 0) return true;
  }
  return false;
}
__name(IsPrecedenceOr, 'IsPrecedenceOr');
function IsPrecedenceAnd(pattern) {
  for (let index = 0; index < pattern.length; index++) {
    if (IsOpenParen(pattern, index)) return true;
  }
  return false;
}
__name(IsPrecedenceAnd, 'IsPrecedenceAnd');
function Or(pattern) {
  let [count3, start] = [0, 0];
  const expressions = [];
  for (let index = 0; index < pattern.length; index++) {
    if (IsOpenParen(pattern, index)) count3 += 1;
    if (IsCloseParen(pattern, index)) count3 -= 1;
    if (IsSeparator(pattern, index) && count3 === 0) {
      const range2 = pattern.slice(start, index);
      if (range2.length > 0) expressions.push(TemplateLiteralParse(range2));
      start = index + 1;
    }
  }
  const range = pattern.slice(start);
  if (range.length > 0) expressions.push(TemplateLiteralParse(range));
  if (expressions.length === 0) return { type: 'const', const: '' };
  if (expressions.length === 1) return expressions[0];
  return { type: 'or', expr: expressions };
}
__name(Or, 'Or');
function And(pattern) {
  function Group(value, index) {
    if (!IsOpenParen(value, index))
      throw new TemplateLiteralParserError(
        `TemplateLiteralParser: Index must point to open parens`
      );
    let count3 = 0;
    for (let scan = index; scan < value.length; scan++) {
      if (IsOpenParen(value, scan)) count3 += 1;
      if (IsCloseParen(value, scan)) count3 -= 1;
      if (count3 === 0) return [index, scan];
    }
    throw new TemplateLiteralParserError(
      `TemplateLiteralParser: Unclosed group parens in expression`
    );
  }
  __name(Group, 'Group');
  function Range(pattern2, index) {
    for (let scan = index; scan < pattern2.length; scan++) {
      if (IsOpenParen(pattern2, scan)) return [index, scan];
    }
    return [index, pattern2.length];
  }
  __name(Range, 'Range');
  const expressions = [];
  for (let index = 0; index < pattern.length; index++) {
    if (IsOpenParen(pattern, index)) {
      const [start, end] = Group(pattern, index);
      const range = pattern.slice(start, end + 1);
      expressions.push(TemplateLiteralParse(range));
      index = end;
    } else {
      const [start, end] = Range(pattern, index);
      const range = pattern.slice(start, end);
      if (range.length > 0) expressions.push(TemplateLiteralParse(range));
      index = end - 1;
    }
  }
  return expressions.length === 0
    ? { type: 'const', const: '' }
    : expressions.length === 1
      ? expressions[0]
      : { type: 'and', expr: expressions };
}
__name(And, 'And');
function TemplateLiteralParse(pattern) {
  return IsGroup(pattern)
    ? TemplateLiteralParse(InGroup(pattern))
    : IsPrecedenceOr(pattern)
      ? Or(pattern)
      : IsPrecedenceAnd(pattern)
        ? And(pattern)
        : { type: 'const', const: Unescape(pattern) };
}
__name(TemplateLiteralParse, 'TemplateLiteralParse');
function TemplateLiteralParseExact(pattern) {
  return TemplateLiteralParse(pattern.slice(1, pattern.length - 1));
}
__name(TemplateLiteralParseExact, 'TemplateLiteralParseExact');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/finite.mjs
var TemplateLiteralFiniteError = class extends TypeBoxError {
  static {
    __name(this, 'TemplateLiteralFiniteError');
  }
};
function IsNumberExpression(expression) {
  return (
    expression.type === 'or' &&
    expression.expr.length === 2 &&
    expression.expr[0].type === 'const' &&
    expression.expr[0].const === '0' &&
    expression.expr[1].type === 'const' &&
    expression.expr[1].const === '[1-9][0-9]*'
  );
}
__name(IsNumberExpression, 'IsNumberExpression');
function IsBooleanExpression(expression) {
  return (
    expression.type === 'or' &&
    expression.expr.length === 2 &&
    expression.expr[0].type === 'const' &&
    expression.expr[0].const === 'true' &&
    expression.expr[1].type === 'const' &&
    expression.expr[1].const === 'false'
  );
}
__name(IsBooleanExpression, 'IsBooleanExpression');
function IsStringExpression(expression) {
  return expression.type === 'const' && expression.const === '.*';
}
__name(IsStringExpression, 'IsStringExpression');
function IsTemplateLiteralExpressionFinite(expression) {
  return IsNumberExpression(expression) || IsStringExpression(expression)
    ? false
    : IsBooleanExpression(expression)
      ? true
      : expression.type === 'and'
        ? expression.expr.every((expr) =>
            IsTemplateLiteralExpressionFinite(expr)
          )
        : expression.type === 'or'
          ? expression.expr.every((expr) =>
              IsTemplateLiteralExpressionFinite(expr)
            )
          : expression.type === 'const'
            ? true
            : (() => {
                throw new TemplateLiteralFiniteError(`Unknown expression type`);
              })();
}
__name(IsTemplateLiteralExpressionFinite, 'IsTemplateLiteralExpressionFinite');
function IsTemplateLiteralFinite(schema) {
  const expression = TemplateLiteralParseExact(schema.pattern);
  return IsTemplateLiteralExpressionFinite(expression);
}
__name(IsTemplateLiteralFinite, 'IsTemplateLiteralFinite');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/generate.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TemplateLiteralGenerateError = class extends TypeBoxError {
  static {
    __name(this, 'TemplateLiteralGenerateError');
  }
};
function* GenerateReduce(buffer) {
  if (buffer.length === 1) return yield* buffer[0];
  for (const left of buffer[0]) {
    for (const right of GenerateReduce(buffer.slice(1))) {
      yield `${left}${right}`;
    }
  }
}
__name(GenerateReduce, 'GenerateReduce');
function* GenerateAnd(expression) {
  return yield* GenerateReduce(
    expression.expr.map((expr) => [...TemplateLiteralExpressionGenerate(expr)])
  );
}
__name(GenerateAnd, 'GenerateAnd');
function* GenerateOr(expression) {
  for (const expr of expression.expr)
    yield* TemplateLiteralExpressionGenerate(expr);
}
__name(GenerateOr, 'GenerateOr');
function* GenerateConst(expression) {
  return yield expression.const;
}
__name(GenerateConst, 'GenerateConst');
function* TemplateLiteralExpressionGenerate(expression) {
  return expression.type === 'and'
    ? yield* GenerateAnd(expression)
    : expression.type === 'or'
      ? yield* GenerateOr(expression)
      : expression.type === 'const'
        ? yield* GenerateConst(expression)
        : (() => {
            throw new TemplateLiteralGenerateError('Unknown expression');
          })();
}
__name(TemplateLiteralExpressionGenerate, 'TemplateLiteralExpressionGenerate');
function TemplateLiteralGenerate(schema) {
  const expression = TemplateLiteralParseExact(schema.pattern);
  return IsTemplateLiteralExpressionFinite(expression)
    ? [...TemplateLiteralExpressionGenerate(expression)]
    : [];
}
__name(TemplateLiteralGenerate, 'TemplateLiteralGenerate');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/syntax.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/literal/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/literal/literal.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Literal(value, options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Literal',
    const: value,
    type: typeof value,
  };
}
__name(Literal, 'Literal');

// node_modules/@sinclair/typebox/build/esm/type/boolean/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/boolean/boolean.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Boolean(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Boolean',
    type: 'boolean',
  };
}
__name(Boolean, 'Boolean');

// node_modules/@sinclair/typebox/build/esm/type/bigint/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/bigint/bigint.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function BigInt2(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'BigInt',
    type: 'bigint',
  };
}
__name(BigInt2, 'BigInt');

// node_modules/@sinclair/typebox/build/esm/type/number/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/number/number.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Number2(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Number',
    type: 'number',
  };
}
__name(Number2, 'Number');

// node_modules/@sinclair/typebox/build/esm/type/string/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/string/string.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function String2(options3 = {}) {
  return { ...options3, [Kind]: 'String', type: 'string' };
}
__name(String2, 'String');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/syntax.mjs
function* FromUnion(syntax) {
  const trim = syntax.trim().replace(/"|'/g, '');
  return trim === 'boolean'
    ? yield Boolean()
    : trim === 'number'
      ? yield Number2()
      : trim === 'bigint'
        ? yield BigInt2()
        : trim === 'string'
          ? yield String2()
          : yield (() => {
              const literals = trim
                .split('|')
                .map((literal) => Literal(literal.trim()));
              return literals.length === 0
                ? Never()
                : literals.length === 1
                  ? literals[0]
                  : UnionEvaluated(literals);
            })();
}
__name(FromUnion, 'FromUnion');
function* FromTerminal(syntax) {
  if (syntax[1] !== '{') {
    const L = Literal('$');
    const R = FromSyntax(syntax.slice(1));
    return yield* [L, ...R];
  }
  for (let i = 2; i < syntax.length; i++) {
    if (syntax[i] === '}') {
      const L = FromUnion(syntax.slice(2, i));
      const R = FromSyntax(syntax.slice(i + 1));
      return yield* [...L, ...R];
    }
  }
  yield Literal(syntax);
}
__name(FromTerminal, 'FromTerminal');
function* FromSyntax(syntax) {
  for (let i = 0; i < syntax.length; i++) {
    if (syntax[i] === '$') {
      const L = Literal(syntax.slice(0, i));
      const R = FromTerminal(syntax.slice(i));
      return yield* [L, ...R];
    }
  }
  yield Literal(syntax);
}
__name(FromSyntax, 'FromSyntax');
function TemplateLiteralSyntax(syntax) {
  return [...FromSyntax(syntax)];
}
__name(TemplateLiteralSyntax, 'TemplateLiteralSyntax');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/pattern.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TemplateLiteralPatternError = class extends TypeBoxError {
  static {
    __name(this, 'TemplateLiteralPatternError');
  }
};
function Escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
__name(Escape, 'Escape');
function Visit2(schema, acc) {
  return IsTemplateLiteral(schema)
    ? schema.pattern.slice(1, schema.pattern.length - 1)
    : IsUnion(schema)
      ? `(${schema.anyOf.map((schema2) => Visit2(schema2, acc)).join('|')})`
      : IsNumber2(schema)
        ? `${acc}${PatternNumber}`
        : IsInteger(schema)
          ? `${acc}${PatternNumber}`
          : IsBigInt2(schema)
            ? `${acc}${PatternNumber}`
            : IsString2(schema)
              ? `${acc}${PatternString}`
              : IsLiteral(schema)
                ? `${acc}${Escape(schema.const.toString())}`
                : IsBoolean2(schema)
                  ? `${acc}${PatternBoolean}`
                  : (() => {
                      throw new TemplateLiteralPatternError(
                        `Unexpected Kind '${schema[Kind]}'`
                      );
                    })();
}
__name(Visit2, 'Visit');
function TemplateLiteralPattern(kinds) {
  return `^${kinds.map((schema) => Visit2(schema, '')).join('')}$`;
}
__name(TemplateLiteralPattern, 'TemplateLiteralPattern');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/union.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function TemplateLiteralToUnion(schema) {
  const R = TemplateLiteralGenerate(schema);
  const L = R.map((S) => Literal(S));
  return UnionEvaluated(L);
}
__name(TemplateLiteralToUnion, 'TemplateLiteralToUnion');

// node_modules/@sinclair/typebox/build/esm/type/template-literal/template-literal.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function TemplateLiteral(unresolved, options3 = {}) {
  const pattern = IsString(unresolved)
    ? TemplateLiteralPattern(TemplateLiteralSyntax(unresolved))
    : TemplateLiteralPattern(unresolved);
  return { ...options3, [Kind]: 'TemplateLiteral', type: 'string', pattern };
}
__name(TemplateLiteral, 'TemplateLiteral');

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-property-keys.mjs
function FromTemplateLiteral(T) {
  const R = TemplateLiteralGenerate(T);
  return R.map((S) => S.toString());
}
__name(FromTemplateLiteral, 'FromTemplateLiteral');
function FromUnion2(T) {
  const Acc = [];
  for (const L of T) Acc.push(...IndexPropertyKeys(L));
  return Acc;
}
__name(FromUnion2, 'FromUnion');
function FromLiteral(T) {
  return [T.toString()];
}
__name(FromLiteral, 'FromLiteral');
function IndexPropertyKeys(T) {
  return [
    ...new Set(
      IsTemplateLiteral(T)
        ? FromTemplateLiteral(T)
        : IsUnion(T)
          ? FromUnion2(T.anyOf)
          : IsLiteral(T)
            ? FromLiteral(T.const)
            : IsNumber2(T)
              ? ['[number]']
              : IsInteger(T)
                ? ['[number]']
                : []
    ),
  ];
}
__name(IndexPropertyKeys, 'IndexPropertyKeys');

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromProperties(T, P, options3) {
  const Acc = {};
  for (const K2 of Object.getOwnPropertyNames(P)) {
    Acc[K2] = Index(T, IndexPropertyKeys(P[K2]), options3);
  }
  return Acc;
}
__name(FromProperties, 'FromProperties');
function FromMappedResult(T, R, options3) {
  return FromProperties(T, R.properties, options3);
}
__name(FromMappedResult, 'FromMappedResult');
function IndexFromMappedResult(T, R, options3) {
  const P = FromMappedResult(T, R, options3);
  return MappedResult(P);
}
__name(IndexFromMappedResult, 'IndexFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed.mjs
function FromRest(T, K) {
  return T.map((L) => IndexFromPropertyKey(L, K));
}
__name(FromRest, 'FromRest');
function FromIntersectRest(T) {
  return T.filter((L) => !IsNever(L));
}
__name(FromIntersectRest, 'FromIntersectRest');
function FromIntersect(T, K) {
  return IntersectEvaluated(FromIntersectRest(FromRest(T, K)));
}
__name(FromIntersect, 'FromIntersect');
function FromUnionRest(T) {
  return T.some((L) => IsNever(L)) ? [] : T;
}
__name(FromUnionRest, 'FromUnionRest');
function FromUnion3(T, K) {
  return UnionEvaluated(FromUnionRest(FromRest(T, K)));
}
__name(FromUnion3, 'FromUnion');
function FromTuple(T, K) {
  return K in T ? T[K] : K === '[number]' ? UnionEvaluated(T) : Never();
}
__name(FromTuple, 'FromTuple');
function FromArray(T, K) {
  return K === '[number]' ? T : Never();
}
__name(FromArray, 'FromArray');
function FromProperty(T, K) {
  return K in T ? T[K] : Never();
}
__name(FromProperty, 'FromProperty');
function IndexFromPropertyKey(T, K) {
  return IsIntersect(T)
    ? FromIntersect(T.allOf, K)
    : IsUnion(T)
      ? FromUnion3(T.anyOf, K)
      : IsTuple(T)
        ? FromTuple(T.items ?? [], K)
        : IsArray2(T)
          ? FromArray(T.items, K)
          : IsObject2(T)
            ? FromProperty(T.properties, K)
            : Never();
}
__name(IndexFromPropertyKey, 'IndexFromPropertyKey');
function IndexFromPropertyKeys(T, K) {
  return K.map((L) => IndexFromPropertyKey(T, L));
}
__name(IndexFromPropertyKeys, 'IndexFromPropertyKeys');
function FromSchema(T, K) {
  return UnionEvaluated(IndexFromPropertyKeys(T, K));
}
__name(FromSchema, 'FromSchema');
function Index(T, K, options3 = {}) {
  return IsMappedResult(K)
    ? CloneType(IndexFromMappedResult(T, K, options3))
    : IsMappedKey(K)
      ? CloneType(IndexFromMappedKey(T, K, options3))
      : IsSchema(K)
        ? CloneType(FromSchema(T, IndexPropertyKeys(K)), options3)
        : CloneType(FromSchema(T, K), options3);
}
__name(Index, 'Index');

// node_modules/@sinclair/typebox/build/esm/type/indexed/indexed-from-mapped-key.mjs
function MappedIndexPropertyKey(T, K, options3) {
  return { [K]: Index(T, [K], options3) };
}
__name(MappedIndexPropertyKey, 'MappedIndexPropertyKey');
function MappedIndexPropertyKeys(T, K, options3) {
  return K.reduce((Acc, L) => {
    return { ...Acc, ...MappedIndexPropertyKey(T, L, options3) };
  }, {});
}
__name(MappedIndexPropertyKeys, 'MappedIndexPropertyKeys');
function MappedIndexProperties(T, K, options3) {
  return MappedIndexPropertyKeys(T, K.keys, options3);
}
__name(MappedIndexProperties, 'MappedIndexProperties');
function IndexFromMappedKey(T, K, options3) {
  const P = MappedIndexProperties(T, K, options3);
  return MappedResult(P);
}
__name(IndexFromMappedKey, 'IndexFromMappedKey');

// node_modules/@sinclair/typebox/build/esm/type/iterator/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/iterator/iterator.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Iterator(items, options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Iterator',
    type: 'Iterator',
    items: CloneType(items),
  };
}
__name(Iterator, 'Iterator');

// node_modules/@sinclair/typebox/build/esm/type/object/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/object/object.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function _Object(properties, options3 = {}) {
  const propertyKeys = globalThis.Object.getOwnPropertyNames(properties);
  const optionalKeys = propertyKeys.filter((key) =>
    IsOptional(properties[key])
  );
  const requiredKeys = propertyKeys.filter(
    (name) => !optionalKeys.includes(name)
  );
  const clonedAdditionalProperties = IsSchema(options3.additionalProperties)
    ? { additionalProperties: CloneType(options3.additionalProperties) }
    : {};
  const clonedProperties = {};
  for (const key of propertyKeys)
    clonedProperties[key] = CloneType(properties[key]);
  return requiredKeys.length > 0
    ? {
        ...options3,
        ...clonedAdditionalProperties,
        [Kind]: 'Object',
        type: 'object',
        properties: clonedProperties,
        required: requiredKeys,
      }
    : {
        ...options3,
        ...clonedAdditionalProperties,
        [Kind]: 'Object',
        type: 'object',
        properties: clonedProperties,
      };
}
__name(_Object, '_Object');
var Object2 = _Object;

// node_modules/@sinclair/typebox/build/esm/type/promise/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/promise/promise.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Promise2(item, options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Promise',
    type: 'Promise',
    item: CloneType(item),
  };
}
__name(Promise2, 'Promise');

// node_modules/@sinclair/typebox/build/esm/type/readonly/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/readonly/readonly-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/readonly/readonly.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function RemoveReadonly(schema) {
  return Discard(CloneType(schema), [ReadonlyKind]);
}
__name(RemoveReadonly, 'RemoveReadonly');
function AddReadonly(schema) {
  return { ...CloneType(schema), [ReadonlyKind]: 'Readonly' };
}
__name(AddReadonly, 'AddReadonly');
function ReadonlyWithFlag(schema, F) {
  return F === false ? RemoveReadonly(schema) : AddReadonly(schema);
}
__name(ReadonlyWithFlag, 'ReadonlyWithFlag');
function Readonly(schema, enable) {
  const F = enable ?? true;
  return IsMappedResult(schema)
    ? ReadonlyFromMappedResult(schema, F)
    : ReadonlyWithFlag(schema, F);
}
__name(Readonly, 'Readonly');

// node_modules/@sinclair/typebox/build/esm/type/readonly/readonly-from-mapped-result.mjs
function FromProperties2(K, F) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(K))
    Acc[K2] = Readonly(K[K2], F);
  return Acc;
}
__name(FromProperties2, 'FromProperties');
function FromMappedResult2(R, F) {
  return FromProperties2(R.properties, F);
}
__name(FromMappedResult2, 'FromMappedResult');
function ReadonlyFromMappedResult(R, F) {
  const P = FromMappedResult2(R, F);
  return MappedResult(P);
}
__name(ReadonlyFromMappedResult, 'ReadonlyFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/tuple/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/tuple/tuple.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Tuple(items, options3 = {}) {
  const [additionalItems, minItems, maxItems] = [
    false,
    items.length,
    items.length,
  ];
  return items.length > 0
    ? {
        ...options3,
        [Kind]: 'Tuple',
        type: 'array',
        items: CloneRest(items),
        additionalItems,
        minItems,
        maxItems,
      }
    : { ...options3, [Kind]: 'Tuple', type: 'array', minItems, maxItems };
}
__name(Tuple, 'Tuple');

// node_modules/@sinclair/typebox/build/esm/type/mapped/mapped.mjs
function FromMappedResult3(K, P) {
  return K in P ? FromSchemaType(K, P[K]) : MappedResult(P);
}
__name(FromMappedResult3, 'FromMappedResult');
function MappedKeyToKnownMappedResultProperties(K) {
  return { [K]: Literal(K) };
}
__name(
  MappedKeyToKnownMappedResultProperties,
  'MappedKeyToKnownMappedResultProperties'
);
function MappedKeyToUnknownMappedResultProperties(P) {
  const Acc = {};
  for (const L of P) Acc[L] = Literal(L);
  return Acc;
}
__name(
  MappedKeyToUnknownMappedResultProperties,
  'MappedKeyToUnknownMappedResultProperties'
);
function MappedKeyToMappedResultProperties(K, P) {
  return SetIncludes(P, K)
    ? MappedKeyToKnownMappedResultProperties(K)
    : MappedKeyToUnknownMappedResultProperties(P);
}
__name(MappedKeyToMappedResultProperties, 'MappedKeyToMappedResultProperties');
function FromMappedKey(K, P) {
  const R = MappedKeyToMappedResultProperties(K, P);
  return FromMappedResult3(K, R);
}
__name(FromMappedKey, 'FromMappedKey');
function FromRest2(K, T) {
  return T.map((L) => FromSchemaType(K, L));
}
__name(FromRest2, 'FromRest');
function FromProperties3(K, T) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(T))
    Acc[K2] = FromSchemaType(K, T[K2]);
  return Acc;
}
__name(FromProperties3, 'FromProperties');
function FromSchemaType(K, T) {
  return (
    // unevaluated modifier types
    IsOptional(T)
      ? Optional(FromSchemaType(K, Discard(T, [OptionalKind])))
      : IsReadonly(T)
        ? Readonly(FromSchemaType(K, Discard(T, [ReadonlyKind])))
        : // unevaluated mapped types
          IsMappedResult(T)
          ? FromMappedResult3(K, T.properties)
          : IsMappedKey(T)
            ? FromMappedKey(K, T.keys)
            : // unevaluated types
              IsConstructor(T)
              ? Constructor(
                  FromRest2(K, T.parameters),
                  FromSchemaType(K, T.returns)
                )
              : IsFunction2(T)
                ? Function(
                    FromRest2(K, T.parameters),
                    FromSchemaType(K, T.returns)
                  )
                : IsAsyncIterator2(T)
                  ? AsyncIterator(FromSchemaType(K, T.items))
                  : IsIterator2(T)
                    ? Iterator(FromSchemaType(K, T.items))
                    : IsIntersect(T)
                      ? Intersect(FromRest2(K, T.allOf))
                      : IsUnion(T)
                        ? Union(FromRest2(K, T.anyOf))
                        : IsTuple(T)
                          ? Tuple(FromRest2(K, T.items ?? []))
                          : IsObject2(T)
                            ? Object2(FromProperties3(K, T.properties))
                            : IsArray2(T)
                              ? Array2(FromSchemaType(K, T.items))
                              : IsPromise(T)
                                ? Promise2(FromSchemaType(K, T.item))
                                : T
  );
}
__name(FromSchemaType, 'FromSchemaType');
function MappedFunctionReturnType(K, T) {
  const Acc = {};
  for (const L of K) Acc[L] = FromSchemaType(L, T);
  return Acc;
}
__name(MappedFunctionReturnType, 'MappedFunctionReturnType');
function Mapped(key, map3, options3 = {}) {
  const K = IsSchema(key) ? IndexPropertyKeys(key) : key;
  const RT = map3({ [Kind]: 'MappedKey', keys: K });
  const R = MappedFunctionReturnType(K, RT);
  return CloneType(Object2(R), options3);
}
__name(Mapped, 'Mapped');

// node_modules/@sinclair/typebox/build/esm/type/optional/optional.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function RemoveOptional(schema) {
  return Discard(CloneType(schema), [OptionalKind]);
}
__name(RemoveOptional, 'RemoveOptional');
function AddOptional(schema) {
  return { ...CloneType(schema), [OptionalKind]: 'Optional' };
}
__name(AddOptional, 'AddOptional');
function OptionalWithFlag(schema, F) {
  return F === false ? RemoveOptional(schema) : AddOptional(schema);
}
__name(OptionalWithFlag, 'OptionalWithFlag');
function Optional(schema, enable) {
  const F = enable ?? true;
  return IsMappedResult(schema)
    ? OptionalFromMappedResult(schema, F)
    : OptionalWithFlag(schema, F);
}
__name(Optional, 'Optional');

// node_modules/@sinclair/typebox/build/esm/type/optional/optional-from-mapped-result.mjs
function FromProperties4(P, F) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Optional(P[K2], F);
  return Acc;
}
__name(FromProperties4, 'FromProperties');
function FromMappedResult4(R, F) {
  return FromProperties4(R.properties, F);
}
__name(FromMappedResult4, 'FromMappedResult');
function OptionalFromMappedResult(R, F) {
  const P = FromMappedResult4(R, F);
  return MappedResult(P);
}
__name(OptionalFromMappedResult, 'OptionalFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect-create.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function IntersectCreate(T, options3) {
  const allObjects = T.every((schema) => IsObject2(schema));
  const clonedUnevaluatedProperties = IsSchema(options3.unevaluatedProperties)
    ? { unevaluatedProperties: CloneType(options3.unevaluatedProperties) }
    : {};
  return options3.unevaluatedProperties === false ||
    IsSchema(options3.unevaluatedProperties) ||
    allObjects
    ? {
        ...options3,
        ...clonedUnevaluatedProperties,
        [Kind]: 'Intersect',
        type: 'object',
        allOf: CloneRest(T),
      }
    : {
        ...options3,
        ...clonedUnevaluatedProperties,
        [Kind]: 'Intersect',
        allOf: CloneRest(T),
      };
}
__name(IntersectCreate, 'IntersectCreate');

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect-evaluated.mjs
function IsIntersectOptional(T) {
  return T.every((L) => IsOptional(L));
}
__name(IsIntersectOptional, 'IsIntersectOptional');
function RemoveOptionalFromType2(T) {
  return Discard(T, [OptionalKind]);
}
__name(RemoveOptionalFromType2, 'RemoveOptionalFromType');
function RemoveOptionalFromRest2(T) {
  return T.map((L) => (IsOptional(L) ? RemoveOptionalFromType2(L) : L));
}
__name(RemoveOptionalFromRest2, 'RemoveOptionalFromRest');
function ResolveIntersect(T, options3) {
  return IsIntersectOptional(T)
    ? Optional(IntersectCreate(RemoveOptionalFromRest2(T), options3))
    : IntersectCreate(RemoveOptionalFromRest2(T), options3);
}
__name(ResolveIntersect, 'ResolveIntersect');
function IntersectEvaluated(T, options3 = {}) {
  if (T.length === 0) return Never(options3);
  if (T.length === 1) return CloneType(T[0], options3);
  if (T.some((schema) => IsTransform(schema)))
    throw new Error('Cannot intersect transform types');
  return ResolveIntersect(T, options3);
}
__name(IntersectEvaluated, 'IntersectEvaluated');

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect-type.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/intersect/intersect.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Intersect(T, options3 = {}) {
  if (T.length === 0) return Never(options3);
  if (T.length === 1) return CloneType(T[0], options3);
  if (T.some((schema) => IsTransform(schema)))
    throw new Error('Cannot intersect transform types');
  return IntersectCreate(T, options3);
}
__name(Intersect, 'Intersect');

// node_modules/@sinclair/typebox/build/esm/type/awaited/awaited.mjs
function FromRest3(T) {
  return T.map((L) => AwaitedResolve(L));
}
__name(FromRest3, 'FromRest');
function FromIntersect2(T) {
  return Intersect(FromRest3(T));
}
__name(FromIntersect2, 'FromIntersect');
function FromUnion4(T) {
  return Union(FromRest3(T));
}
__name(FromUnion4, 'FromUnion');
function FromPromise(T) {
  return AwaitedResolve(T);
}
__name(FromPromise, 'FromPromise');
function AwaitedResolve(T) {
  return IsIntersect(T)
    ? FromIntersect2(T.allOf)
    : IsUnion(T)
      ? FromUnion4(T.anyOf)
      : IsPromise(T)
        ? FromPromise(T.item)
        : T;
}
__name(AwaitedResolve, 'AwaitedResolve');
function Awaited(T, options3 = {}) {
  return CloneType(AwaitedResolve(T), options3);
}
__name(Awaited, 'Awaited');

// node_modules/@sinclair/typebox/build/esm/type/composite/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/composite/composite.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/keyof/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof-property-keys.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromRest4(T) {
  const Acc = [];
  for (const L of T) Acc.push(KeyOfPropertyKeys(L));
  return Acc;
}
__name(FromRest4, 'FromRest');
function FromIntersect3(T) {
  const C = FromRest4(T);
  const R = SetUnionMany(C);
  return R;
}
__name(FromIntersect3, 'FromIntersect');
function FromUnion5(T) {
  const C = FromRest4(T);
  const R = SetIntersectMany(C);
  return R;
}
__name(FromUnion5, 'FromUnion');
function FromTuple2(T) {
  return T.map((_, I) => I.toString());
}
__name(FromTuple2, 'FromTuple');
function FromArray2(_) {
  return ['[number]'];
}
__name(FromArray2, 'FromArray');
function FromProperties5(T) {
  return globalThis.Object.getOwnPropertyNames(T);
}
__name(FromProperties5, 'FromProperties');
function FromPatternProperties(patternProperties) {
  if (!includePatternProperties) return [];
  const patternPropertyKeys =
    globalThis.Object.getOwnPropertyNames(patternProperties);
  return patternPropertyKeys.map((key) => {
    return key[0] === '^' && key[key.length - 1] === '$'
      ? key.slice(1, key.length - 1)
      : key;
  });
}
__name(FromPatternProperties, 'FromPatternProperties');
function KeyOfPropertyKeys(T) {
  return IsIntersect(T)
    ? FromIntersect3(T.allOf)
    : IsUnion(T)
      ? FromUnion5(T.anyOf)
      : IsTuple(T)
        ? FromTuple2(T.items ?? [])
        : IsArray2(T)
          ? FromArray2(T.items)
          : IsObject2(T)
            ? FromProperties5(T.properties)
            : IsRecord(T)
              ? FromPatternProperties(T.patternProperties)
              : [];
}
__name(KeyOfPropertyKeys, 'KeyOfPropertyKeys');
var includePatternProperties = false;
function KeyOfPattern(schema) {
  includePatternProperties = true;
  const keys = KeyOfPropertyKeys(schema);
  includePatternProperties = false;
  const pattern = keys.map((key) => `(${key})`);
  return `^(${pattern.join('|')})$`;
}
__name(KeyOfPattern, 'KeyOfPattern');

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof.mjs
function KeyOfPropertyKeysToRest(T) {
  return T.map((L) => (L === '[number]' ? Number2() : Literal(L)));
}
__name(KeyOfPropertyKeysToRest, 'KeyOfPropertyKeysToRest');
function KeyOf(T, options3 = {}) {
  if (IsMappedResult(T)) {
    return KeyOfFromMappedResult(T, options3);
  } else {
    const K = KeyOfPropertyKeys(T);
    const S = KeyOfPropertyKeysToRest(K);
    const U = UnionEvaluated(S);
    return CloneType(U, options3);
  }
}
__name(KeyOf, 'KeyOf');

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof-from-mapped-result.mjs
function FromProperties6(K, options3) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(K))
    Acc[K2] = KeyOf(K[K2], options3);
  return Acc;
}
__name(FromProperties6, 'FromProperties');
function FromMappedResult5(R, options3) {
  return FromProperties6(R.properties, options3);
}
__name(FromMappedResult5, 'FromMappedResult');
function KeyOfFromMappedResult(R, options3) {
  const P = FromMappedResult5(R, options3);
  return MappedResult(P);
}
__name(KeyOfFromMappedResult, 'KeyOfFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/keyof/keyof-property-entries.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function KeyOfPropertyEntries(schema) {
  const keys = KeyOfPropertyKeys(schema);
  const schemas = IndexFromPropertyKeys(schema, keys);
  return keys.map((_, index) => [keys[index], schemas[index]]);
}
__name(KeyOfPropertyEntries, 'KeyOfPropertyEntries');

// node_modules/@sinclair/typebox/build/esm/type/composite/composite.mjs
function CompositeKeys(T) {
  const Acc = [];
  for (const L of T) Acc.push(...KeyOfPropertyKeys(L));
  return SetDistinct(Acc);
}
__name(CompositeKeys, 'CompositeKeys');
function FilterNever(T) {
  return T.filter((L) => !IsNever(L));
}
__name(FilterNever, 'FilterNever');
function CompositeProperty(T, K) {
  const Acc = [];
  for (const L of T) Acc.push(...IndexFromPropertyKeys(L, [K]));
  return FilterNever(Acc);
}
__name(CompositeProperty, 'CompositeProperty');
function CompositeProperties(T, K) {
  const Acc = {};
  for (const L of K) {
    Acc[L] = IntersectEvaluated(CompositeProperty(T, L));
  }
  return Acc;
}
__name(CompositeProperties, 'CompositeProperties');
function Composite(T, options3 = {}) {
  const K = CompositeKeys(T);
  const P = CompositeProperties(T, K);
  const R = Object2(P, options3);
  return R;
}
__name(Composite, 'Composite');

// node_modules/@sinclair/typebox/build/esm/type/const/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/const/const.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/date/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/date/date.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Date2(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Date',
    type: 'Date',
  };
}
__name(Date2, 'Date');

// node_modules/@sinclair/typebox/build/esm/type/null/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/null/null.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Null(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Null',
    type: 'null',
  };
}
__name(Null, 'Null');

// node_modules/@sinclair/typebox/build/esm/type/symbol/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/symbol/symbol.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Symbol2(options3) {
  return { ...options3, [Kind]: 'Symbol', type: 'symbol' };
}
__name(Symbol2, 'Symbol');

// node_modules/@sinclair/typebox/build/esm/type/undefined/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/undefined/undefined.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Undefined(options3 = {}) {
  return { ...options3, [Kind]: 'Undefined', type: 'undefined' };
}
__name(Undefined, 'Undefined');

// node_modules/@sinclair/typebox/build/esm/type/uint8array/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/uint8array/uint8array.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Uint8Array2(options3 = {}) {
  return { ...options3, [Kind]: 'Uint8Array', type: 'Uint8Array' };
}
__name(Uint8Array2, 'Uint8Array');

// node_modules/@sinclair/typebox/build/esm/type/unknown/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/unknown/unknown.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Unknown(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Unknown',
  };
}
__name(Unknown, 'Unknown');

// node_modules/@sinclair/typebox/build/esm/type/const/const.mjs
function FromArray3(T) {
  return T.map((L) => FromValue(L, false));
}
__name(FromArray3, 'FromArray');
function FromProperties7(value) {
  const Acc = {};
  for (const K of globalThis.Object.getOwnPropertyNames(value))
    Acc[K] = Readonly(FromValue(value[K], false));
  return Acc;
}
__name(FromProperties7, 'FromProperties');
function ConditionalReadonly(T, root) {
  return root === true ? T : Readonly(T);
}
__name(ConditionalReadonly, 'ConditionalReadonly');
function FromValue(value, root) {
  return IsAsyncIterator(value)
    ? ConditionalReadonly(Any(), root)
    : IsIterator(value)
      ? ConditionalReadonly(Any(), root)
      : IsArray(value)
        ? Readonly(Tuple(FromArray3(value)))
        : IsUint8Array(value)
          ? Uint8Array2()
          : IsDate(value)
            ? Date2()
            : IsObject(value)
              ? ConditionalReadonly(Object2(FromProperties7(value)), root)
              : IsFunction(value)
                ? ConditionalReadonly(Function([], Unknown()), root)
                : IsUndefined(value)
                  ? Undefined()
                  : IsNull(value)
                    ? Null()
                    : IsSymbol(value)
                      ? Symbol2()
                      : IsBigInt(value)
                        ? BigInt2()
                        : IsNumber(value)
                          ? Literal(value)
                          : IsBoolean(value)
                            ? Literal(value)
                            : IsString(value)
                              ? Literal(value)
                              : Object2({});
}
__name(FromValue, 'FromValue');
function Const(T, options3 = {}) {
  return CloneType(FromValue(T, true), options3);
}
__name(Const, 'Const');

// node_modules/@sinclair/typebox/build/esm/type/constructor-parameters/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/constructor-parameters/constructor-parameters.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ConstructorParameters(schema, options3 = {}) {
  return Tuple(CloneRest(schema.parameters), { ...options3 });
}
__name(ConstructorParameters, 'ConstructorParameters');

// node_modules/@sinclair/typebox/build/esm/type/deref/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/deref/deref.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromRest5(schema, references) {
  return schema.map((schema2) => Deref(schema2, references));
}
__name(FromRest5, 'FromRest');
function FromProperties8(properties, references) {
  const Acc = {};
  for (const K of globalThis.Object.getOwnPropertyNames(properties)) {
    Acc[K] = Deref(properties[K], references);
  }
  return Acc;
}
__name(FromProperties8, 'FromProperties');
function FromConstructor(schema, references) {
  schema.parameters = FromRest5(schema.parameters, references);
  schema.returns = Deref(schema.returns, references);
  return schema;
}
__name(FromConstructor, 'FromConstructor');
function FromFunction(schema, references) {
  schema.parameters = FromRest5(schema.parameters, references);
  schema.returns = Deref(schema.returns, references);
  return schema;
}
__name(FromFunction, 'FromFunction');
function FromIntersect4(schema, references) {
  schema.allOf = FromRest5(schema.allOf, references);
  return schema;
}
__name(FromIntersect4, 'FromIntersect');
function FromUnion6(schema, references) {
  schema.anyOf = FromRest5(schema.anyOf, references);
  return schema;
}
__name(FromUnion6, 'FromUnion');
function FromTuple3(schema, references) {
  if (IsUndefined(schema.items)) return schema;
  schema.items = FromRest5(schema.items, references);
  return schema;
}
__name(FromTuple3, 'FromTuple');
function FromArray4(schema, references) {
  schema.items = Deref(schema.items, references);
  return schema;
}
__name(FromArray4, 'FromArray');
function FromObject(schema, references) {
  schema.properties = FromProperties8(schema.properties, references);
  return schema;
}
__name(FromObject, 'FromObject');
function FromPromise2(schema, references) {
  schema.item = Deref(schema.item, references);
  return schema;
}
__name(FromPromise2, 'FromPromise');
function FromAsyncIterator(schema, references) {
  schema.items = Deref(schema.items, references);
  return schema;
}
__name(FromAsyncIterator, 'FromAsyncIterator');
function FromIterator(schema, references) {
  schema.items = Deref(schema.items, references);
  return schema;
}
__name(FromIterator, 'FromIterator');
function FromRef(schema, references) {
  const target = references.find((remote) => remote.$id === schema.$ref);
  if (target === void 0)
    throw Error(`Unable to dereference schema with $id ${schema.$ref}`);
  const discard = Discard(target, ['$id']);
  return Deref(discard, references);
}
__name(FromRef, 'FromRef');
function DerefResolve(schema, references) {
  return IsConstructor(schema)
    ? FromConstructor(schema, references)
    : IsFunction2(schema)
      ? FromFunction(schema, references)
      : IsIntersect(schema)
        ? FromIntersect4(schema, references)
        : IsUnion(schema)
          ? FromUnion6(schema, references)
          : IsTuple(schema)
            ? FromTuple3(schema, references)
            : IsArray2(schema)
              ? FromArray4(schema, references)
              : IsObject2(schema)
                ? FromObject(schema, references)
                : IsPromise(schema)
                  ? FromPromise2(schema, references)
                  : IsAsyncIterator2(schema)
                    ? FromAsyncIterator(schema, references)
                    : IsIterator2(schema)
                      ? FromIterator(schema, references)
                      : IsRef(schema)
                        ? FromRef(schema, references)
                        : schema;
}
__name(DerefResolve, 'DerefResolve');
function Deref(schema, references) {
  return DerefResolve(CloneType(schema), CloneRest(references));
}
__name(Deref, 'Deref');

// node_modules/@sinclair/typebox/build/esm/type/enum/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/enum/enum.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Enum(item, options3 = {}) {
  if (IsUndefined(item)) throw new Error('Enum undefined or empty');
  const values1 = globalThis.Object.getOwnPropertyNames(item)
    .filter((key) => isNaN(key))
    .map((key) => item[key]);
  const values2 = [...new Set(values1)];
  const anyOf = values2.map((value) => Literal(value));
  return Union(anyOf, { ...options3, [Hint]: 'Enum' });
}
__name(Enum, 'Enum');

// node_modules/@sinclair/typebox/build/esm/type/exclude/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extends/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-check.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ExtendsResolverError = class extends TypeBoxError {
  static {
    __name(this, 'ExtendsResolverError');
  }
};
var ExtendsResult;
(function (ExtendsResult2) {
  ExtendsResult2[(ExtendsResult2['Union'] = 0)] = 'Union';
  ExtendsResult2[(ExtendsResult2['True'] = 1)] = 'True';
  ExtendsResult2[(ExtendsResult2['False'] = 2)] = 'False';
})(ExtendsResult || (ExtendsResult = {}));
function IntoBooleanResult(result) {
  return result === ExtendsResult.False ? result : ExtendsResult.True;
}
__name(IntoBooleanResult, 'IntoBooleanResult');
function Throw(message) {
  throw new ExtendsResolverError(message);
}
__name(Throw, 'Throw');
function IsStructuralRight(right) {
  return (
    type_exports.IsNever(right) ||
    type_exports.IsIntersect(right) ||
    type_exports.IsUnion(right) ||
    type_exports.IsUnknown(right) ||
    type_exports.IsAny(right)
  );
}
__name(IsStructuralRight, 'IsStructuralRight');
function StructuralRight(left, right) {
  return type_exports.IsNever(right)
    ? FromNeverRight(left, right)
    : type_exports.IsIntersect(right)
      ? FromIntersectRight(left, right)
      : type_exports.IsUnion(right)
        ? FromUnionRight(left, right)
        : type_exports.IsUnknown(right)
          ? FromUnknownRight(left, right)
          : type_exports.IsAny(right)
            ? FromAnyRight(left, right)
            : Throw('StructuralRight');
}
__name(StructuralRight, 'StructuralRight');
function FromAnyRight(left, right) {
  return ExtendsResult.True;
}
__name(FromAnyRight, 'FromAnyRight');
function FromAny(left, right) {
  return type_exports.IsIntersect(right)
    ? FromIntersectRight(left, right)
    : type_exports.IsUnion(right) &&
        right.anyOf.some(
          (schema) =>
            type_exports.IsAny(schema) || type_exports.IsUnknown(schema)
        )
      ? ExtendsResult.True
      : type_exports.IsUnion(right)
        ? ExtendsResult.Union
        : type_exports.IsUnknown(right)
          ? ExtendsResult.True
          : type_exports.IsAny(right)
            ? ExtendsResult.True
            : ExtendsResult.Union;
}
__name(FromAny, 'FromAny');
function FromArrayRight(left, right) {
  return type_exports.IsUnknown(left)
    ? ExtendsResult.False
    : type_exports.IsAny(left)
      ? ExtendsResult.Union
      : type_exports.IsNever(left)
        ? ExtendsResult.True
        : ExtendsResult.False;
}
__name(FromArrayRight, 'FromArrayRight');
function FromArray5(left, right) {
  return type_exports.IsObject(right) && IsObjectArrayLike(right)
    ? ExtendsResult.True
    : IsStructuralRight(right)
      ? StructuralRight(left, right)
      : !type_exports.IsArray(right)
        ? ExtendsResult.False
        : IntoBooleanResult(Visit3(left.items, right.items));
}
__name(FromArray5, 'FromArray');
function FromAsyncIterator2(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : !type_exports.IsAsyncIterator(right)
      ? ExtendsResult.False
      : IntoBooleanResult(Visit3(left.items, right.items));
}
__name(FromAsyncIterator2, 'FromAsyncIterator');
function FromBigInt(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsBigInt(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromBigInt, 'FromBigInt');
function FromBooleanRight(left, right) {
  return type_exports.IsLiteralBoolean(left)
    ? ExtendsResult.True
    : type_exports.IsBoolean(left)
      ? ExtendsResult.True
      : ExtendsResult.False;
}
__name(FromBooleanRight, 'FromBooleanRight');
function FromBoolean(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsBoolean(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromBoolean, 'FromBoolean');
function FromConstructor2(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : !type_exports.IsConstructor(right)
        ? ExtendsResult.False
        : left.parameters.length > right.parameters.length
          ? ExtendsResult.False
          : !left.parameters.every(
                (schema, index) =>
                  IntoBooleanResult(Visit3(right.parameters[index], schema)) ===
                  ExtendsResult.True
              )
            ? ExtendsResult.False
            : IntoBooleanResult(Visit3(left.returns, right.returns));
}
__name(FromConstructor2, 'FromConstructor');
function FromDate(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsDate(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromDate, 'FromDate');
function FromFunction2(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : !type_exports.IsFunction(right)
        ? ExtendsResult.False
        : left.parameters.length > right.parameters.length
          ? ExtendsResult.False
          : !left.parameters.every(
                (schema, index) =>
                  IntoBooleanResult(Visit3(right.parameters[index], schema)) ===
                  ExtendsResult.True
              )
            ? ExtendsResult.False
            : IntoBooleanResult(Visit3(left.returns, right.returns));
}
__name(FromFunction2, 'FromFunction');
function FromIntegerRight(left, right) {
  return type_exports.IsLiteral(left) && value_exports.IsNumber(left.const)
    ? ExtendsResult.True
    : type_exports.IsNumber(left) || type_exports.IsInteger(left)
      ? ExtendsResult.True
      : ExtendsResult.False;
}
__name(FromIntegerRight, 'FromIntegerRight');
function FromInteger(left, right) {
  return type_exports.IsInteger(right) || type_exports.IsNumber(right)
    ? ExtendsResult.True
    : IsStructuralRight(right)
      ? StructuralRight(left, right)
      : type_exports.IsObject(right)
        ? FromObjectRight(left, right)
        : type_exports.IsRecord(right)
          ? FromRecordRight(left, right)
          : ExtendsResult.False;
}
__name(FromInteger, 'FromInteger');
function FromIntersectRight(left, right) {
  return right.allOf.every(
    (schema) => Visit3(left, schema) === ExtendsResult.True
  )
    ? ExtendsResult.True
    : ExtendsResult.False;
}
__name(FromIntersectRight, 'FromIntersectRight');
function FromIntersect5(left, right) {
  return left.allOf.some(
    (schema) => Visit3(schema, right) === ExtendsResult.True
  )
    ? ExtendsResult.True
    : ExtendsResult.False;
}
__name(FromIntersect5, 'FromIntersect');
function FromIterator2(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : !type_exports.IsIterator(right)
      ? ExtendsResult.False
      : IntoBooleanResult(Visit3(left.items, right.items));
}
__name(FromIterator2, 'FromIterator');
function FromLiteral2(left, right) {
  return type_exports.IsLiteral(right) && right.const === left.const
    ? ExtendsResult.True
    : IsStructuralRight(right)
      ? StructuralRight(left, right)
      : type_exports.IsObject(right)
        ? FromObjectRight(left, right)
        : type_exports.IsRecord(right)
          ? FromRecordRight(left, right)
          : type_exports.IsString(right)
            ? FromStringRight(left, right)
            : type_exports.IsNumber(right)
              ? FromNumberRight(left, right)
              : type_exports.IsInteger(right)
                ? FromIntegerRight(left, right)
                : type_exports.IsBoolean(right)
                  ? FromBooleanRight(left, right)
                  : ExtendsResult.False;
}
__name(FromLiteral2, 'FromLiteral');
function FromNeverRight(left, right) {
  return ExtendsResult.False;
}
__name(FromNeverRight, 'FromNeverRight');
function FromNever(left, right) {
  return ExtendsResult.True;
}
__name(FromNever, 'FromNever');
function UnwrapTNot(schema) {
  let [current, depth] = [schema, 0];
  while (true) {
    if (!type_exports.IsNot(current)) break;
    current = current.not;
    depth += 1;
  }
  return depth % 2 === 0 ? current : Unknown();
}
__name(UnwrapTNot, 'UnwrapTNot');
function FromNot(left, right) {
  return type_exports.IsNot(left)
    ? Visit3(UnwrapTNot(left), right)
    : type_exports.IsNot(right)
      ? Visit3(left, UnwrapTNot(right))
      : Throw('Invalid fallthrough for Not');
}
__name(FromNot, 'FromNot');
function FromNull(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsNull(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromNull, 'FromNull');
function FromNumberRight(left, right) {
  return type_exports.IsLiteralNumber(left)
    ? ExtendsResult.True
    : type_exports.IsNumber(left) || type_exports.IsInteger(left)
      ? ExtendsResult.True
      : ExtendsResult.False;
}
__name(FromNumberRight, 'FromNumberRight');
function FromNumber(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsInteger(right) || type_exports.IsNumber(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromNumber, 'FromNumber');
function IsObjectPropertyCount(schema, count3) {
  return Object.getOwnPropertyNames(schema.properties).length === count3;
}
__name(IsObjectPropertyCount, 'IsObjectPropertyCount');
function IsObjectStringLike(schema) {
  return IsObjectArrayLike(schema);
}
__name(IsObjectStringLike, 'IsObjectStringLike');
function IsObjectSymbolLike(schema) {
  return (
    IsObjectPropertyCount(schema, 0) ||
    (IsObjectPropertyCount(schema, 1) &&
      'description' in schema.properties &&
      type_exports.IsUnion(schema.properties.description) &&
      schema.properties.description.anyOf.length === 2 &&
      ((type_exports.IsString(schema.properties.description.anyOf[0]) &&
        type_exports.IsUndefined(schema.properties.description.anyOf[1])) ||
        (type_exports.IsString(schema.properties.description.anyOf[1]) &&
          type_exports.IsUndefined(schema.properties.description.anyOf[0]))))
  );
}
__name(IsObjectSymbolLike, 'IsObjectSymbolLike');
function IsObjectNumberLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
__name(IsObjectNumberLike, 'IsObjectNumberLike');
function IsObjectBooleanLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
__name(IsObjectBooleanLike, 'IsObjectBooleanLike');
function IsObjectBigIntLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
__name(IsObjectBigIntLike, 'IsObjectBigIntLike');
function IsObjectDateLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
__name(IsObjectDateLike, 'IsObjectDateLike');
function IsObjectUint8ArrayLike(schema) {
  return IsObjectArrayLike(schema);
}
__name(IsObjectUint8ArrayLike, 'IsObjectUint8ArrayLike');
function IsObjectFunctionLike(schema) {
  const length = Number2();
  return (
    IsObjectPropertyCount(schema, 0) ||
    (IsObjectPropertyCount(schema, 1) &&
      'length' in schema.properties &&
      IntoBooleanResult(Visit3(schema.properties['length'], length)) ===
        ExtendsResult.True)
  );
}
__name(IsObjectFunctionLike, 'IsObjectFunctionLike');
function IsObjectConstructorLike(schema) {
  return IsObjectPropertyCount(schema, 0);
}
__name(IsObjectConstructorLike, 'IsObjectConstructorLike');
function IsObjectArrayLike(schema) {
  const length = Number2();
  return (
    IsObjectPropertyCount(schema, 0) ||
    (IsObjectPropertyCount(schema, 1) &&
      'length' in schema.properties &&
      IntoBooleanResult(Visit3(schema.properties['length'], length)) ===
        ExtendsResult.True)
  );
}
__name(IsObjectArrayLike, 'IsObjectArrayLike');
function IsObjectPromiseLike(schema) {
  const then = Function([Any()], Any());
  return (
    IsObjectPropertyCount(schema, 0) ||
    (IsObjectPropertyCount(schema, 1) &&
      'then' in schema.properties &&
      IntoBooleanResult(Visit3(schema.properties['then'], then)) ===
        ExtendsResult.True)
  );
}
__name(IsObjectPromiseLike, 'IsObjectPromiseLike');
function Property(left, right) {
  return Visit3(left, right) === ExtendsResult.False
    ? ExtendsResult.False
    : type_exports.IsOptional(left) && !type_exports.IsOptional(right)
      ? ExtendsResult.False
      : ExtendsResult.True;
}
__name(Property, 'Property');
function FromObjectRight(left, right) {
  return type_exports.IsUnknown(left)
    ? ExtendsResult.False
    : type_exports.IsAny(left)
      ? ExtendsResult.Union
      : type_exports.IsNever(left) ||
          (type_exports.IsLiteralString(left) && IsObjectStringLike(right)) ||
          (type_exports.IsLiteralNumber(left) && IsObjectNumberLike(right)) ||
          (type_exports.IsLiteralBoolean(left) && IsObjectBooleanLike(right)) ||
          (type_exports.IsSymbol(left) && IsObjectSymbolLike(right)) ||
          (type_exports.IsBigInt(left) && IsObjectBigIntLike(right)) ||
          (type_exports.IsString(left) && IsObjectStringLike(right)) ||
          (type_exports.IsSymbol(left) && IsObjectSymbolLike(right)) ||
          (type_exports.IsNumber(left) && IsObjectNumberLike(right)) ||
          (type_exports.IsInteger(left) && IsObjectNumberLike(right)) ||
          (type_exports.IsBoolean(left) && IsObjectBooleanLike(right)) ||
          (type_exports.IsUint8Array(left) && IsObjectUint8ArrayLike(right)) ||
          (type_exports.IsDate(left) && IsObjectDateLike(right)) ||
          (type_exports.IsConstructor(left) &&
            IsObjectConstructorLike(right)) ||
          (type_exports.IsFunction(left) && IsObjectFunctionLike(right))
        ? ExtendsResult.True
        : type_exports.IsRecord(left) && type_exports.IsString(RecordKey(left))
          ? (() => {
              return right[Hint] === 'Record'
                ? ExtendsResult.True
                : ExtendsResult.False;
            })()
          : type_exports.IsRecord(left) &&
              type_exports.IsNumber(RecordKey(left))
            ? (() => {
                return IsObjectPropertyCount(right, 0)
                  ? ExtendsResult.True
                  : ExtendsResult.False;
              })()
            : ExtendsResult.False;
}
__name(FromObjectRight, 'FromObjectRight');
function FromObject2(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsRecord(right)
      ? FromRecordRight(left, right)
      : !type_exports.IsObject(right)
        ? ExtendsResult.False
        : (() => {
            for (const key of Object.getOwnPropertyNames(right.properties)) {
              if (
                !(key in left.properties) &&
                !type_exports.IsOptional(right.properties[key])
              ) {
                return ExtendsResult.False;
              }
              if (type_exports.IsOptional(right.properties[key])) {
                return ExtendsResult.True;
              }
              if (
                Property(left.properties[key], right.properties[key]) ===
                ExtendsResult.False
              ) {
                return ExtendsResult.False;
              }
            }
            return ExtendsResult.True;
          })();
}
__name(FromObject2, 'FromObject');
function FromPromise3(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right) && IsObjectPromiseLike(right)
      ? ExtendsResult.True
      : !type_exports.IsPromise(right)
        ? ExtendsResult.False
        : IntoBooleanResult(Visit3(left.item, right.item));
}
__name(FromPromise3, 'FromPromise');
function RecordKey(schema) {
  return PatternNumberExact in schema.patternProperties
    ? Number2()
    : PatternStringExact in schema.patternProperties
      ? String2()
      : Throw('Unknown record key pattern');
}
__name(RecordKey, 'RecordKey');
function RecordValue(schema) {
  return PatternNumberExact in schema.patternProperties
    ? schema.patternProperties[PatternNumberExact]
    : PatternStringExact in schema.patternProperties
      ? schema.patternProperties[PatternStringExact]
      : Throw('Unable to get record value schema');
}
__name(RecordValue, 'RecordValue');
function FromRecordRight(left, right) {
  const [Key, Value] = [RecordKey(right), RecordValue(right)];
  return type_exports.IsLiteralString(left) &&
    type_exports.IsNumber(Key) &&
    IntoBooleanResult(Visit3(left, Value)) === ExtendsResult.True
    ? ExtendsResult.True
    : type_exports.IsUint8Array(left) && type_exports.IsNumber(Key)
      ? Visit3(left, Value)
      : type_exports.IsString(left) && type_exports.IsNumber(Key)
        ? Visit3(left, Value)
        : type_exports.IsArray(left) && type_exports.IsNumber(Key)
          ? Visit3(left, Value)
          : type_exports.IsObject(left)
            ? (() => {
                for (const key of Object.getOwnPropertyNames(left.properties)) {
                  if (
                    Property(Value, left.properties[key]) ===
                    ExtendsResult.False
                  ) {
                    return ExtendsResult.False;
                  }
                }
                return ExtendsResult.True;
              })()
            : ExtendsResult.False;
}
__name(FromRecordRight, 'FromRecordRight');
function FromRecord(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : !type_exports.IsRecord(right)
        ? ExtendsResult.False
        : Visit3(RecordValue(left), RecordValue(right));
}
__name(FromRecord, 'FromRecord');
function FromRegExp(left, right) {
  const L = type_exports.IsRegExp(left) ? String2() : left;
  const R = type_exports.IsRegExp(right) ? String2() : right;
  return Visit3(L, R);
}
__name(FromRegExp, 'FromRegExp');
function FromStringRight(left, right) {
  return type_exports.IsLiteral(left) && value_exports.IsString(left.const)
    ? ExtendsResult.True
    : type_exports.IsString(left)
      ? ExtendsResult.True
      : ExtendsResult.False;
}
__name(FromStringRight, 'FromStringRight');
function FromString(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsString(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromString, 'FromString');
function FromSymbol(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsSymbol(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromSymbol, 'FromSymbol');
function FromTemplateLiteral2(left, right) {
  return type_exports.IsTemplateLiteral(left)
    ? Visit3(TemplateLiteralToUnion(left), right)
    : type_exports.IsTemplateLiteral(right)
      ? Visit3(left, TemplateLiteralToUnion(right))
      : Throw('Invalid fallthrough for TemplateLiteral');
}
__name(FromTemplateLiteral2, 'FromTemplateLiteral');
function IsArrayOfTuple(left, right) {
  return (
    type_exports.IsArray(right) &&
    left.items !== void 0 &&
    left.items.every(
      (schema) => Visit3(schema, right.items) === ExtendsResult.True
    )
  );
}
__name(IsArrayOfTuple, 'IsArrayOfTuple');
function FromTupleRight(left, right) {
  return type_exports.IsNever(left)
    ? ExtendsResult.True
    : type_exports.IsUnknown(left)
      ? ExtendsResult.False
      : type_exports.IsAny(left)
        ? ExtendsResult.Union
        : ExtendsResult.False;
}
__name(FromTupleRight, 'FromTupleRight');
function FromTuple4(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right) && IsObjectArrayLike(right)
      ? ExtendsResult.True
      : type_exports.IsArray(right) && IsArrayOfTuple(left, right)
        ? ExtendsResult.True
        : !type_exports.IsTuple(right)
          ? ExtendsResult.False
          : (value_exports.IsUndefined(left.items) &&
                !value_exports.IsUndefined(right.items)) ||
              (!value_exports.IsUndefined(left.items) &&
                value_exports.IsUndefined(right.items))
            ? ExtendsResult.False
            : value_exports.IsUndefined(left.items) &&
                !value_exports.IsUndefined(right.items)
              ? ExtendsResult.True
              : left.items.every(
                    (schema, index) =>
                      Visit3(schema, right.items[index]) === ExtendsResult.True
                  )
                ? ExtendsResult.True
                : ExtendsResult.False;
}
__name(FromTuple4, 'FromTuple');
function FromUint8Array(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsUint8Array(right)
          ? ExtendsResult.True
          : ExtendsResult.False;
}
__name(FromUint8Array, 'FromUint8Array');
function FromUndefined(left, right) {
  return IsStructuralRight(right)
    ? StructuralRight(left, right)
    : type_exports.IsObject(right)
      ? FromObjectRight(left, right)
      : type_exports.IsRecord(right)
        ? FromRecordRight(left, right)
        : type_exports.IsVoid(right)
          ? FromVoidRight(left, right)
          : type_exports.IsUndefined(right)
            ? ExtendsResult.True
            : ExtendsResult.False;
}
__name(FromUndefined, 'FromUndefined');
function FromUnionRight(left, right) {
  return right.anyOf.some(
    (schema) => Visit3(left, schema) === ExtendsResult.True
  )
    ? ExtendsResult.True
    : ExtendsResult.False;
}
__name(FromUnionRight, 'FromUnionRight');
function FromUnion7(left, right) {
  return left.anyOf.every(
    (schema) => Visit3(schema, right) === ExtendsResult.True
  )
    ? ExtendsResult.True
    : ExtendsResult.False;
}
__name(FromUnion7, 'FromUnion');
function FromUnknownRight(left, right) {
  return ExtendsResult.True;
}
__name(FromUnknownRight, 'FromUnknownRight');
function FromUnknown(left, right) {
  return type_exports.IsNever(right)
    ? FromNeverRight(left, right)
    : type_exports.IsIntersect(right)
      ? FromIntersectRight(left, right)
      : type_exports.IsUnion(right)
        ? FromUnionRight(left, right)
        : type_exports.IsAny(right)
          ? FromAnyRight(left, right)
          : type_exports.IsString(right)
            ? FromStringRight(left, right)
            : type_exports.IsNumber(right)
              ? FromNumberRight(left, right)
              : type_exports.IsInteger(right)
                ? FromIntegerRight(left, right)
                : type_exports.IsBoolean(right)
                  ? FromBooleanRight(left, right)
                  : type_exports.IsArray(right)
                    ? FromArrayRight(left, right)
                    : type_exports.IsTuple(right)
                      ? FromTupleRight(left, right)
                      : type_exports.IsObject(right)
                        ? FromObjectRight(left, right)
                        : type_exports.IsUnknown(right)
                          ? ExtendsResult.True
                          : ExtendsResult.False;
}
__name(FromUnknown, 'FromUnknown');
function FromVoidRight(left, right) {
  return type_exports.IsUndefined(left)
    ? ExtendsResult.True
    : type_exports.IsUndefined(left)
      ? ExtendsResult.True
      : ExtendsResult.False;
}
__name(FromVoidRight, 'FromVoidRight');
function FromVoid(left, right) {
  return type_exports.IsIntersect(right)
    ? FromIntersectRight(left, right)
    : type_exports.IsUnion(right)
      ? FromUnionRight(left, right)
      : type_exports.IsUnknown(right)
        ? FromUnknownRight(left, right)
        : type_exports.IsAny(right)
          ? FromAnyRight(left, right)
          : type_exports.IsObject(right)
            ? FromObjectRight(left, right)
            : type_exports.IsVoid(right)
              ? ExtendsResult.True
              : ExtendsResult.False;
}
__name(FromVoid, 'FromVoid');
function Visit3(left, right) {
  return (
    // resolvable
    type_exports.IsTemplateLiteral(left) ||
      type_exports.IsTemplateLiteral(right)
      ? FromTemplateLiteral2(left, right)
      : type_exports.IsRegExp(left) || type_exports.IsRegExp(right)
        ? FromRegExp(left, right)
        : type_exports.IsNot(left) || type_exports.IsNot(right)
          ? FromNot(left, right)
          : // standard
            type_exports.IsAny(left)
            ? FromAny(left, right)
            : type_exports.IsArray(left)
              ? FromArray5(left, right)
              : type_exports.IsBigInt(left)
                ? FromBigInt(left, right)
                : type_exports.IsBoolean(left)
                  ? FromBoolean(left, right)
                  : type_exports.IsAsyncIterator(left)
                    ? FromAsyncIterator2(left, right)
                    : type_exports.IsConstructor(left)
                      ? FromConstructor2(left, right)
                      : type_exports.IsDate(left)
                        ? FromDate(left, right)
                        : type_exports.IsFunction(left)
                          ? FromFunction2(left, right)
                          : type_exports.IsInteger(left)
                            ? FromInteger(left, right)
                            : type_exports.IsIntersect(left)
                              ? FromIntersect5(left, right)
                              : type_exports.IsIterator(left)
                                ? FromIterator2(left, right)
                                : type_exports.IsLiteral(left)
                                  ? FromLiteral2(left, right)
                                  : type_exports.IsNever(left)
                                    ? FromNever(left, right)
                                    : type_exports.IsNull(left)
                                      ? FromNull(left, right)
                                      : type_exports.IsNumber(left)
                                        ? FromNumber(left, right)
                                        : type_exports.IsObject(left)
                                          ? FromObject2(left, right)
                                          : type_exports.IsRecord(left)
                                            ? FromRecord(left, right)
                                            : type_exports.IsString(left)
                                              ? FromString(left, right)
                                              : type_exports.IsSymbol(left)
                                                ? FromSymbol(left, right)
                                                : type_exports.IsTuple(left)
                                                  ? FromTuple4(left, right)
                                                  : type_exports.IsPromise(left)
                                                    ? FromPromise3(left, right)
                                                    : type_exports.IsUint8Array(
                                                          left
                                                        )
                                                      ? FromUint8Array(
                                                          left,
                                                          right
                                                        )
                                                      : type_exports.IsUndefined(
                                                            left
                                                          )
                                                        ? FromUndefined(
                                                            left,
                                                            right
                                                          )
                                                        : type_exports.IsUnion(
                                                              left
                                                            )
                                                          ? FromUnion7(
                                                              left,
                                                              right
                                                            )
                                                          : type_exports.IsUnknown(
                                                                left
                                                              )
                                                            ? FromUnknown(
                                                                left,
                                                                right
                                                              )
                                                            : type_exports.IsVoid(
                                                                  left
                                                                )
                                                              ? FromVoid(
                                                                  left,
                                                                  right
                                                                )
                                                              : Throw(
                                                                  `Unknown left type operand '${left[Kind]}'`
                                                                )
  );
}
__name(Visit3, 'Visit');
function ExtendsCheck(left, right) {
  return Visit3(left, right);
}
__name(ExtendsCheck, 'ExtendsCheck');

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-from-mapped-key.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extends/extends.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromProperties9(P, Right, True, False, options3) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Extends(P[K2], Right, True, False, options3);
  return Acc;
}
__name(FromProperties9, 'FromProperties');
function FromMappedResult6(Left, Right, True, False, options3) {
  return FromProperties9(Left.properties, Right, True, False, options3);
}
__name(FromMappedResult6, 'FromMappedResult');
function ExtendsFromMappedResult(Left, Right, True, False, options3) {
  const P = FromMappedResult6(Left, Right, True, False, options3);
  return MappedResult(P);
}
__name(ExtendsFromMappedResult, 'ExtendsFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/extends/extends.mjs
function ExtendsResolve(left, right, trueType, falseType) {
  const R = ExtendsCheck(left, right);
  return R === ExtendsResult.Union
    ? Union([trueType, falseType])
    : R === ExtendsResult.True
      ? trueType
      : falseType;
}
__name(ExtendsResolve, 'ExtendsResolve');
function Extends(L, R, T, F, options3 = {}) {
  return IsMappedResult(L)
    ? ExtendsFromMappedResult(L, R, T, F, options3)
    : IsMappedKey(L)
      ? CloneType(ExtendsFromMappedKey(L, R, T, F, options3))
      : CloneType(ExtendsResolve(L, R, T, F), options3);
}
__name(Extends, 'Extends');

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-from-mapped-key.mjs
function FromPropertyKey(K, U, L, R, options3) {
  return {
    [K]: Extends(Literal(K), U, L, R, options3),
  };
}
__name(FromPropertyKey, 'FromPropertyKey');
function FromPropertyKeys(K, U, L, R, options3) {
  return K.reduce((Acc, LK) => {
    return { ...Acc, ...FromPropertyKey(LK, U, L, R, options3) };
  }, {});
}
__name(FromPropertyKeys, 'FromPropertyKeys');
function FromMappedKey2(K, U, L, R, options3) {
  return FromPropertyKeys(K.keys, U, L, R, options3);
}
__name(FromMappedKey2, 'FromMappedKey');
function ExtendsFromMappedKey(T, U, L, R, options3) {
  const P = FromMappedKey2(T, U, L, R, options3);
  return MappedResult(P);
}
__name(ExtendsFromMappedKey, 'ExtendsFromMappedKey');

// node_modules/@sinclair/typebox/build/esm/type/extends/extends-undefined.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Intersect2(schema) {
  return schema.allOf.every((schema2) => ExtendsUndefinedCheck(schema2));
}
__name(Intersect2, 'Intersect');
function Union2(schema) {
  return schema.anyOf.some((schema2) => ExtendsUndefinedCheck(schema2));
}
__name(Union2, 'Union');
function Not(schema) {
  return !ExtendsUndefinedCheck(schema.not);
}
__name(Not, 'Not');
function ExtendsUndefinedCheck(schema) {
  return schema[Kind] === 'Intersect'
    ? Intersect2(schema)
    : schema[Kind] === 'Union'
      ? Union2(schema)
      : schema[Kind] === 'Not'
        ? Not(schema)
        : schema[Kind] === 'Undefined'
          ? true
          : false;
}
__name(ExtendsUndefinedCheck, 'ExtendsUndefinedCheck');

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude-from-template-literal.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ExcludeFromTemplateLiteral(L, R) {
  return Exclude(TemplateLiteralToUnion(L), R);
}
__name(ExcludeFromTemplateLiteral, 'ExcludeFromTemplateLiteral');

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude.mjs
function ExcludeRest(L, R) {
  const excluded = L.filter(
    (inner) => ExtendsCheck(inner, R) === ExtendsResult.False
  );
  return excluded.length === 1 ? excluded[0] : Union(excluded);
}
__name(ExcludeRest, 'ExcludeRest');
function Exclude(L, R, options3 = {}) {
  if (IsTemplateLiteral(L))
    return CloneType(ExcludeFromTemplateLiteral(L, R), options3);
  if (IsMappedResult(L))
    return CloneType(ExcludeFromMappedResult(L, R), options3);
  return CloneType(
    IsUnion(L)
      ? ExcludeRest(L.anyOf, R)
      : ExtendsCheck(L, R) !== ExtendsResult.False
        ? Never()
        : L,
    options3
  );
}
__name(Exclude, 'Exclude');

// node_modules/@sinclair/typebox/build/esm/type/exclude/exclude-from-mapped-result.mjs
function FromProperties10(P, U) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Exclude(P[K2], U);
  return Acc;
}
__name(FromProperties10, 'FromProperties');
function FromMappedResult7(R, T) {
  return FromProperties10(R.properties, T);
}
__name(FromMappedResult7, 'FromMappedResult');
function ExcludeFromMappedResult(R, T) {
  const P = FromMappedResult7(R, T);
  return MappedResult(P);
}
__name(ExcludeFromMappedResult, 'ExcludeFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/extract/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extract/extract-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extract/extract.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/extract/extract-from-template-literal.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ExtractFromTemplateLiteral(L, R) {
  return Extract(TemplateLiteralToUnion(L), R);
}
__name(ExtractFromTemplateLiteral, 'ExtractFromTemplateLiteral');

// node_modules/@sinclair/typebox/build/esm/type/extract/extract.mjs
function ExtractRest(L, R) {
  const extracted = L.filter(
    (inner) => ExtendsCheck(inner, R) !== ExtendsResult.False
  );
  return extracted.length === 1 ? extracted[0] : Union(extracted);
}
__name(ExtractRest, 'ExtractRest');
function Extract(L, R, options3 = {}) {
  if (IsTemplateLiteral(L))
    return CloneType(ExtractFromTemplateLiteral(L, R), options3);
  if (IsMappedResult(L))
    return CloneType(ExtractFromMappedResult(L, R), options3);
  return CloneType(
    IsUnion(L)
      ? ExtractRest(L.anyOf, R)
      : ExtendsCheck(L, R) !== ExtendsResult.False
        ? L
        : Never(),
    options3
  );
}
__name(Extract, 'Extract');

// node_modules/@sinclair/typebox/build/esm/type/extract/extract-from-mapped-result.mjs
function FromProperties11(P, T) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Extract(P[K2], T);
  return Acc;
}
__name(FromProperties11, 'FromProperties');
function FromMappedResult8(R, T) {
  return FromProperties11(R.properties, T);
}
__name(FromMappedResult8, 'FromMappedResult');
function ExtractFromMappedResult(R, T) {
  const P = FromMappedResult8(R, T);
  return MappedResult(P);
}
__name(ExtractFromMappedResult, 'ExtractFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/instance-type/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/instance-type/instance-type.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function InstanceType(schema, options3 = {}) {
  return CloneType(schema.returns, options3);
}
__name(InstanceType, 'InstanceType');

// node_modules/@sinclair/typebox/build/esm/type/integer/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/integer/integer.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Integer(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Integer',
    type: 'integer',
  };
}
__name(Integer, 'Integer');

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/capitalize.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/intrinsic.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/intrinsic-from-mapped-key.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function MappedIntrinsicPropertyKey(K, M, options3) {
  return {
    [K]: Intrinsic(Literal(K), M, options3),
  };
}
__name(MappedIntrinsicPropertyKey, 'MappedIntrinsicPropertyKey');
function MappedIntrinsicPropertyKeys(K, M, options3) {
  return K.reduce((Acc, L) => {
    return { ...Acc, ...MappedIntrinsicPropertyKey(L, M, options3) };
  }, {});
}
__name(MappedIntrinsicPropertyKeys, 'MappedIntrinsicPropertyKeys');
function MappedIntrinsicProperties(T, M, options3) {
  return MappedIntrinsicPropertyKeys(T['keys'], M, options3);
}
__name(MappedIntrinsicProperties, 'MappedIntrinsicProperties');
function IntrinsicFromMappedKey(T, M, options3) {
  const P = MappedIntrinsicProperties(T, M, options3);
  return MappedResult(P);
}
__name(IntrinsicFromMappedKey, 'IntrinsicFromMappedKey');

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/intrinsic.mjs
function ApplyUncapitalize(value) {
  const [first, rest] = [value.slice(0, 1), value.slice(1)];
  return [first.toLowerCase(), rest].join('');
}
__name(ApplyUncapitalize, 'ApplyUncapitalize');
function ApplyCapitalize(value) {
  const [first, rest] = [value.slice(0, 1), value.slice(1)];
  return [first.toUpperCase(), rest].join('');
}
__name(ApplyCapitalize, 'ApplyCapitalize');
function ApplyUppercase(value) {
  return value.toUpperCase();
}
__name(ApplyUppercase, 'ApplyUppercase');
function ApplyLowercase(value) {
  return value.toLowerCase();
}
__name(ApplyLowercase, 'ApplyLowercase');
function FromTemplateLiteral3(schema, mode, options3) {
  const expression = TemplateLiteralParseExact(schema.pattern);
  const finite = IsTemplateLiteralExpressionFinite(expression);
  if (!finite)
    return { ...schema, pattern: FromLiteralValue(schema.pattern, mode) };
  const strings = [...TemplateLiteralExpressionGenerate(expression)];
  const literals = strings.map((value) => Literal(value));
  const mapped = FromRest6(literals, mode);
  const union = Union(mapped);
  return TemplateLiteral([union], options3);
}
__name(FromTemplateLiteral3, 'FromTemplateLiteral');
function FromLiteralValue(value, mode) {
  return typeof value === 'string'
    ? mode === 'Uncapitalize'
      ? ApplyUncapitalize(value)
      : mode === 'Capitalize'
        ? ApplyCapitalize(value)
        : mode === 'Uppercase'
          ? ApplyUppercase(value)
          : mode === 'Lowercase'
            ? ApplyLowercase(value)
            : value
    : value.toString();
}
__name(FromLiteralValue, 'FromLiteralValue');
function FromRest6(T, M) {
  return T.map((L) => Intrinsic(L, M));
}
__name(FromRest6, 'FromRest');
function Intrinsic(schema, mode, options3 = {}) {
  return (
    // Intrinsic-Mapped-Inference
    IsMappedKey(schema)
      ? IntrinsicFromMappedKey(schema, mode, options3)
      : // Standard-Inference
        IsTemplateLiteral(schema)
        ? FromTemplateLiteral3(schema, mode, schema)
        : IsUnion(schema)
          ? Union(FromRest6(schema.anyOf, mode), options3)
          : IsLiteral(schema)
            ? Literal(FromLiteralValue(schema.const, mode), options3)
            : schema
  );
}
__name(Intrinsic, 'Intrinsic');

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/capitalize.mjs
function Capitalize(T, options3 = {}) {
  return Intrinsic(T, 'Capitalize', options3);
}
__name(Capitalize, 'Capitalize');

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/lowercase.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Lowercase(T, options3 = {}) {
  return Intrinsic(T, 'Lowercase', options3);
}
__name(Lowercase, 'Lowercase');

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/uncapitalize.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Uncapitalize(T, options3 = {}) {
  return Intrinsic(T, 'Uncapitalize', options3);
}
__name(Uncapitalize, 'Uncapitalize');

// node_modules/@sinclair/typebox/build/esm/type/intrinsic/uppercase.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Uppercase(T, options3 = {}) {
  return Intrinsic(T, 'Uppercase', options3);
}
__name(Uppercase, 'Uppercase');

// node_modules/@sinclair/typebox/build/esm/type/not/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/not/not.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Not2(schema, options3) {
  return {
    ...options3,
    [Kind]: 'Not',
    not: CloneType(schema),
  };
}
__name(Not2, 'Not');

// node_modules/@sinclair/typebox/build/esm/type/omit/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/omit/omit-from-mapped-key.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/omit/omit.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/omit/omit-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromProperties12(P, K, options3) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Omit(P[K2], K, options3);
  return Acc;
}
__name(FromProperties12, 'FromProperties');
function FromMappedResult9(R, K, options3) {
  return FromProperties12(R.properties, K, options3);
}
__name(FromMappedResult9, 'FromMappedResult');
function OmitFromMappedResult(R, K, options3) {
  const P = FromMappedResult9(R, K, options3);
  return MappedResult(P);
}
__name(OmitFromMappedResult, 'OmitFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/omit/omit.mjs
function FromIntersect6(T, K) {
  return T.map((T2) => OmitResolve(T2, K));
}
__name(FromIntersect6, 'FromIntersect');
function FromUnion8(T, K) {
  return T.map((T2) => OmitResolve(T2, K));
}
__name(FromUnion8, 'FromUnion');
function FromProperty2(T, K) {
  const { [K]: _, ...R } = T;
  return R;
}
__name(FromProperty2, 'FromProperty');
function FromProperties13(T, K) {
  return K.reduce((T2, K2) => FromProperty2(T2, K2), T);
}
__name(FromProperties13, 'FromProperties');
function OmitResolve(T, K) {
  return IsIntersect(T)
    ? Intersect(FromIntersect6(T.allOf, K))
    : IsUnion(T)
      ? Union(FromUnion8(T.anyOf, K))
      : IsObject2(T)
        ? Object2(FromProperties13(T.properties, K))
        : Object2({});
}
__name(OmitResolve, 'OmitResolve');
function Omit(T, K, options3 = {}) {
  if (IsMappedKey(K)) return OmitFromMappedKey(T, K, options3);
  if (IsMappedResult(T)) return OmitFromMappedResult(T, K, options3);
  const I = IsSchema(K) ? IndexPropertyKeys(K) : K;
  const D = Discard(T, [TransformKind, '$id', 'required']);
  const R = CloneType(OmitResolve(T, I), options3);
  return { ...D, ...R };
}
__name(Omit, 'Omit');

// node_modules/@sinclair/typebox/build/esm/type/omit/omit-from-mapped-key.mjs
function FromPropertyKey2(T, K, options3) {
  return {
    [K]: Omit(T, [K], options3),
  };
}
__name(FromPropertyKey2, 'FromPropertyKey');
function FromPropertyKeys2(T, K, options3) {
  return K.reduce((Acc, LK) => {
    return { ...Acc, ...FromPropertyKey2(T, LK, options3) };
  }, {});
}
__name(FromPropertyKeys2, 'FromPropertyKeys');
function FromMappedKey3(T, K, options3) {
  return FromPropertyKeys2(T, K.keys, options3);
}
__name(FromMappedKey3, 'FromMappedKey');
function OmitFromMappedKey(T, K, options3) {
  const P = FromMappedKey3(T, K, options3);
  return MappedResult(P);
}
__name(OmitFromMappedKey, 'OmitFromMappedKey');

// node_modules/@sinclair/typebox/build/esm/type/parameters/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/parameters/parameters.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Parameters(schema, options3 = {}) {
  return Tuple(CloneRest(schema.parameters), { ...options3 });
}
__name(Parameters, 'Parameters');

// node_modules/@sinclair/typebox/build/esm/type/partial/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/partial/partial-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/partial/partial.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromRest7(T) {
  return T.map((L) => PartialResolve(L));
}
__name(FromRest7, 'FromRest');
function FromProperties14(T) {
  const Acc = {};
  for (const K of globalThis.Object.getOwnPropertyNames(T))
    Acc[K] = Optional(T[K]);
  return Acc;
}
__name(FromProperties14, 'FromProperties');
function PartialResolve(T) {
  return IsIntersect(T)
    ? Intersect(FromRest7(T.allOf))
    : IsUnion(T)
      ? Union(FromRest7(T.anyOf))
      : IsObject2(T)
        ? Object2(FromProperties14(T.properties))
        : Object2({});
}
__name(PartialResolve, 'PartialResolve');
function Partial(T, options3 = {}) {
  if (IsMappedResult(T)) return PartialFromMappedResult(T, options3);
  const D = Discard(T, [TransformKind, '$id', 'required']);
  const R = CloneType(PartialResolve(T), options3);
  return { ...D, ...R };
}
__name(Partial, 'Partial');

// node_modules/@sinclair/typebox/build/esm/type/partial/partial-from-mapped-result.mjs
function FromProperties15(K, options3) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(K))
    Acc[K2] = Partial(K[K2], options3);
  return Acc;
}
__name(FromProperties15, 'FromProperties');
function FromMappedResult10(R, options3) {
  return FromProperties15(R.properties, options3);
}
__name(FromMappedResult10, 'FromMappedResult');
function PartialFromMappedResult(R, options3) {
  const P = FromMappedResult10(R, options3);
  return MappedResult(P);
}
__name(PartialFromMappedResult, 'PartialFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/pick/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/pick/pick-from-mapped-key.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/pick/pick.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/pick/pick-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromProperties16(P, K, options3) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Pick(P[K2], K, options3);
  return Acc;
}
__name(FromProperties16, 'FromProperties');
function FromMappedResult11(R, K, options3) {
  return FromProperties16(R.properties, K, options3);
}
__name(FromMappedResult11, 'FromMappedResult');
function PickFromMappedResult(R, K, options3) {
  const P = FromMappedResult11(R, K, options3);
  return MappedResult(P);
}
__name(PickFromMappedResult, 'PickFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/pick/pick.mjs
function FromIntersect7(T, K) {
  return T.map((T2) => PickResolve(T2, K));
}
__name(FromIntersect7, 'FromIntersect');
function FromUnion9(T, K) {
  return T.map((T2) => PickResolve(T2, K));
}
__name(FromUnion9, 'FromUnion');
function FromProperties17(T, K) {
  const Acc = {};
  for (const K2 of K) if (K2 in T) Acc[K2] = T[K2];
  return Acc;
}
__name(FromProperties17, 'FromProperties');
function PickResolve(T, K) {
  return IsIntersect(T)
    ? Intersect(FromIntersect7(T.allOf, K))
    : IsUnion(T)
      ? Union(FromUnion9(T.anyOf, K))
      : IsObject2(T)
        ? Object2(FromProperties17(T.properties, K))
        : Object2({});
}
__name(PickResolve, 'PickResolve');
function Pick(T, K, options3 = {}) {
  if (IsMappedKey(K)) return PickFromMappedKey(T, K, options3);
  if (IsMappedResult(T)) return PickFromMappedResult(T, K, options3);
  const I = IsSchema(K) ? IndexPropertyKeys(K) : K;
  const D = Discard(T, [TransformKind, '$id', 'required']);
  const R = CloneType(PickResolve(T, I), options3);
  return { ...D, ...R };
}
__name(Pick, 'Pick');

// node_modules/@sinclair/typebox/build/esm/type/pick/pick-from-mapped-key.mjs
function FromPropertyKey3(T, K, options3) {
  return {
    [K]: Pick(T, [K], options3),
  };
}
__name(FromPropertyKey3, 'FromPropertyKey');
function FromPropertyKeys3(T, K, options3) {
  return K.reduce((Acc, LK) => {
    return { ...Acc, ...FromPropertyKey3(T, LK, options3) };
  }, {});
}
__name(FromPropertyKeys3, 'FromPropertyKeys');
function FromMappedKey4(T, K, options3) {
  return FromPropertyKeys3(T, K.keys, options3);
}
__name(FromMappedKey4, 'FromMappedKey');
function PickFromMappedKey(T, K, options3) {
  const P = FromMappedKey4(T, K, options3);
  return MappedResult(P);
}
__name(PickFromMappedKey, 'PickFromMappedKey');

// node_modules/@sinclair/typebox/build/esm/type/readonly-optional/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/readonly-optional/readonly-optional.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ReadonlyOptional(schema) {
  return Readonly(Optional(schema));
}
__name(ReadonlyOptional, 'ReadonlyOptional');

// node_modules/@sinclair/typebox/build/esm/type/record/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/record/record.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function RecordCreateFromPattern(pattern, T, options3) {
  return {
    ...options3,
    [Kind]: 'Record',
    type: 'object',
    patternProperties: { [pattern]: CloneType(T) },
  };
}
__name(RecordCreateFromPattern, 'RecordCreateFromPattern');
function RecordCreateFromKeys(K, T, options3) {
  const Acc = {};
  for (const K2 of K) Acc[K2] = CloneType(T);
  return Object2(Acc, { ...options3, [Hint]: 'Record' });
}
__name(RecordCreateFromKeys, 'RecordCreateFromKeys');
function FromTemplateLiteralKey(K, T, options3) {
  return IsTemplateLiteralFinite(K)
    ? RecordCreateFromKeys(IndexPropertyKeys(K), T, options3)
    : RecordCreateFromPattern(K.pattern, T, options3);
}
__name(FromTemplateLiteralKey, 'FromTemplateLiteralKey');
function FromUnionKey(K, T, options3) {
  return RecordCreateFromKeys(IndexPropertyKeys(Union(K)), T, options3);
}
__name(FromUnionKey, 'FromUnionKey');
function FromLiteralKey(K, T, options3) {
  return RecordCreateFromKeys([K.toString()], T, options3);
}
__name(FromLiteralKey, 'FromLiteralKey');
function FromRegExpKey(K, T, options3) {
  return RecordCreateFromPattern(K.source, T, options3);
}
__name(FromRegExpKey, 'FromRegExpKey');
function FromStringKey(K, T, options3) {
  const pattern = IsUndefined(K.pattern) ? PatternStringExact : K.pattern;
  return RecordCreateFromPattern(pattern, T, options3);
}
__name(FromStringKey, 'FromStringKey');
function FromAnyKey(K, T, options3) {
  return RecordCreateFromPattern(PatternStringExact, T, options3);
}
__name(FromAnyKey, 'FromAnyKey');
function FromNeverKey(K, T, options3) {
  return RecordCreateFromPattern(PatternNeverExact, T, options3);
}
__name(FromNeverKey, 'FromNeverKey');
function FromIntegerKey(_, T, options3) {
  return RecordCreateFromPattern(PatternNumberExact, T, options3);
}
__name(FromIntegerKey, 'FromIntegerKey');
function FromNumberKey(_, T, options3) {
  return RecordCreateFromPattern(PatternNumberExact, T, options3);
}
__name(FromNumberKey, 'FromNumberKey');
function Record(K, T, options3 = {}) {
  return IsUnion(K)
    ? FromUnionKey(K.anyOf, T, options3)
    : IsTemplateLiteral(K)
      ? FromTemplateLiteralKey(K, T, options3)
      : IsLiteral(K)
        ? FromLiteralKey(K.const, T, options3)
        : IsInteger(K)
          ? FromIntegerKey(K, T, options3)
          : IsNumber2(K)
            ? FromNumberKey(K, T, options3)
            : IsRegExp2(K)
              ? FromRegExpKey(K, T, options3)
              : IsString2(K)
                ? FromStringKey(K, T, options3)
                : IsAny(K)
                  ? FromAnyKey(K, T, options3)
                  : IsNever(K)
                    ? FromNeverKey(K, T, options3)
                    : Never(options3);
}
__name(Record, 'Record');

// node_modules/@sinclair/typebox/build/esm/type/recursive/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/recursive/recursive.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var Ordinal = 0;
function Recursive(callback, options3 = {}) {
  if (IsUndefined(options3.$id)) options3.$id = `T${Ordinal++}`;
  const thisType = callback({ [Kind]: 'This', $ref: `${options3.$id}` });
  thisType.$id = options3.$id;
  return CloneType({ ...options3, [Hint]: 'Recursive', ...thisType });
}
__name(Recursive, 'Recursive');

// node_modules/@sinclair/typebox/build/esm/type/ref/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/ref/ref.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Ref(unresolved, options3 = {}) {
  if (IsString(unresolved))
    return { ...options3, [Kind]: 'Ref', $ref: unresolved };
  if (IsUndefined(unresolved.$id))
    throw new Error('Reference target type must specify an $id');
  return {
    ...options3,
    [Kind]: 'Ref',
    $ref: unresolved.$id,
  };
}
__name(Ref, 'Ref');

// node_modules/@sinclair/typebox/build/esm/type/regexp/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/regexp/regexp.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function RegExp2(unresolved, options3 = {}) {
  const expr = IsString(unresolved)
    ? new globalThis.RegExp(unresolved)
    : unresolved;
  return {
    ...options3,
    [Kind]: 'RegExp',
    type: 'RegExp',
    source: expr.source,
    flags: expr.flags,
  };
}
__name(RegExp2, 'RegExp');

// node_modules/@sinclair/typebox/build/esm/type/required/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/required/required-from-mapped-result.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/required/required.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromRest8(T) {
  return T.map((L) => RequiredResolve(L));
}
__name(FromRest8, 'FromRest');
function FromProperties18(T) {
  const Acc = {};
  for (const K of globalThis.Object.getOwnPropertyNames(T))
    Acc[K] = Discard(T[K], [OptionalKind]);
  return Acc;
}
__name(FromProperties18, 'FromProperties');
function RequiredResolve(T) {
  return IsIntersect(T)
    ? Intersect(FromRest8(T.allOf))
    : IsUnion(T)
      ? Union(FromRest8(T.anyOf))
      : IsObject2(T)
        ? Object2(FromProperties18(T.properties))
        : Object2({});
}
__name(RequiredResolve, 'RequiredResolve');
function Required(T, options3 = {}) {
  if (IsMappedResult(T)) {
    return RequiredFromMappedResult(T, options3);
  } else {
    const D = Discard(T, [TransformKind, '$id', 'required']);
    const R = CloneType(RequiredResolve(T), options3);
    return { ...D, ...R };
  }
}
__name(Required, 'Required');

// node_modules/@sinclair/typebox/build/esm/type/required/required-from-mapped-result.mjs
function FromProperties19(P, options3) {
  const Acc = {};
  for (const K2 of globalThis.Object.getOwnPropertyNames(P))
    Acc[K2] = Required(P[K2], options3);
  return Acc;
}
__name(FromProperties19, 'FromProperties');
function FromMappedResult12(R, options3) {
  return FromProperties19(R.properties, options3);
}
__name(FromMappedResult12, 'FromMappedResult');
function RequiredFromMappedResult(R, options3) {
  const P = FromMappedResult12(R, options3);
  return MappedResult(P);
}
__name(RequiredFromMappedResult, 'RequiredFromMappedResult');

// node_modules/@sinclair/typebox/build/esm/type/rest/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/rest/rest.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function RestResolve(T) {
  return IsIntersect(T)
    ? CloneRest(T.allOf)
    : IsUnion(T)
      ? CloneRest(T.anyOf)
      : IsTuple(T)
        ? CloneRest(T.items ?? [])
        : [];
}
__name(RestResolve, 'RestResolve');
function Rest(T) {
  return CloneRest(RestResolve(T));
}
__name(Rest, 'Rest');

// node_modules/@sinclair/typebox/build/esm/type/return-type/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/return-type/return-type.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ReturnType(schema, options3 = {}) {
  return CloneType(schema.returns, options3);
}
__name(ReturnType, 'ReturnType');

// node_modules/@sinclair/typebox/build/esm/type/schema/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/schema/anyschema.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/schema/schema.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/static/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/static/static.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/strict/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/strict/strict.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Strict(schema) {
  return JSON.parse(JSON.stringify(schema));
}
__name(Strict, 'Strict');

// node_modules/@sinclair/typebox/build/esm/type/transform/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/transform/transform.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TransformDecodeBuilder = class {
  static {
    __name(this, 'TransformDecodeBuilder');
  }
  constructor(schema) {
    this.schema = schema;
  }
  Decode(decode) {
    return new TransformEncodeBuilder(this.schema, decode);
  }
};
var TransformEncodeBuilder = class {
  static {
    __name(this, 'TransformEncodeBuilder');
  }
  constructor(schema, decode) {
    this.schema = schema;
    this.decode = decode;
  }
  EncodeTransform(encode, schema) {
    const Encode2 = /* @__PURE__ */ __name(
      (value) => schema[TransformKind].Encode(encode(value)),
      'Encode'
    );
    const Decode2 = /* @__PURE__ */ __name(
      (value) => this.decode(schema[TransformKind].Decode(value)),
      'Decode'
    );
    const Codec = { Encode: Encode2, Decode: Decode2 };
    return { ...schema, [TransformKind]: Codec };
  }
  EncodeSchema(encode, schema) {
    const Codec = { Decode: this.decode, Encode: encode };
    return { ...schema, [TransformKind]: Codec };
  }
  Encode(encode) {
    const schema = CloneType(this.schema);
    return IsTransform(schema)
      ? this.EncodeTransform(encode, schema)
      : this.EncodeSchema(encode, schema);
  }
};
function Transform(schema) {
  return new TransformDecodeBuilder(schema);
}
__name(Transform, 'Transform');

// node_modules/@sinclair/typebox/build/esm/type/unsafe/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/unsafe/unsafe.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Unsafe(options3 = {}) {
  return {
    ...options3,
    [Kind]: options3[Kind] ?? 'Unsafe',
  };
}
__name(Unsafe, 'Unsafe');

// node_modules/@sinclair/typebox/build/esm/type/void/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/void/void.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Void(options3 = {}) {
  return {
    ...options3,
    [Kind]: 'Void',
    type: 'void',
  };
}
__name(Void, 'Void');

// node_modules/@sinclair/typebox/build/esm/type/type/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/type/json.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/type/type.mjs
var type_exports3 = {};
__export(type_exports3, {
  Any: () => Any,
  Array: () => Array2,
  AsyncIterator: () => AsyncIterator,
  Awaited: () => Awaited,
  BigInt: () => BigInt2,
  Boolean: () => Boolean,
  Capitalize: () => Capitalize,
  Composite: () => Composite,
  Const: () => Const,
  Constructor: () => Constructor,
  ConstructorParameters: () => ConstructorParameters,
  Date: () => Date2,
  Deref: () => Deref,
  Enum: () => Enum,
  Exclude: () => Exclude,
  Extends: () => Extends,
  Extract: () => Extract,
  Function: () => Function,
  Index: () => Index,
  InstanceType: () => InstanceType,
  Integer: () => Integer,
  Intersect: () => Intersect,
  Iterator: () => Iterator,
  KeyOf: () => KeyOf,
  Literal: () => Literal,
  Lowercase: () => Lowercase,
  Mapped: () => Mapped,
  Never: () => Never,
  Not: () => Not2,
  Null: () => Null,
  Number: () => Number2,
  Object: () => Object2,
  Omit: () => Omit,
  Optional: () => Optional,
  Parameters: () => Parameters,
  Partial: () => Partial,
  Pick: () => Pick,
  Promise: () => Promise2,
  Readonly: () => Readonly,
  ReadonlyOptional: () => ReadonlyOptional,
  Record: () => Record,
  Recursive: () => Recursive,
  Ref: () => Ref,
  RegExp: () => RegExp2,
  Required: () => Required,
  Rest: () => Rest,
  ReturnType: () => ReturnType,
  Strict: () => Strict,
  String: () => String2,
  Symbol: () => Symbol2,
  TemplateLiteral: () => TemplateLiteral,
  Transform: () => Transform,
  Tuple: () => Tuple,
  Uint8Array: () => Uint8Array2,
  Uncapitalize: () => Uncapitalize,
  Undefined: () => Undefined,
  Union: () => Union,
  Unknown: () => Unknown,
  Unsafe: () => Unsafe,
  Uppercase: () => Uppercase,
  Void: () => Void,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/type/javascript.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/type/type/index.mjs
var Type = type_exports3;

// node_modules/yahoo-finance2/dist/esm/src/lib/queue.js
var QueueOptionsSchema = Type.Object(
  {
    // TODO: adds func type to json schema which is not supported
    //_queue?: Queue;
    concurrency: Type.Optional(Type.Number()),
    timeout: Type.Optional(Type.Number()),
    // TODO
  },
  {
    additionalProperties: false,
    title: 'QueueOptions',
  }
);
var Queue = class {
  static {
    __name(this, 'Queue');
  }
  constructor(opts = {}) {
    this.concurrency = 1;
    this._running = 0;
    this._queue = [];
    if (opts.concurrency) this.concurrency = opts.concurrency;
  }
  runNext() {
    const job = this._queue.shift();
    if (!job) return;
    this._running++;
    job
      .func()
      .then((result) => job.resolve(result))
      .catch((error3) => job.reject(error3))
      .finally(() => {
        this._running--;
        this.checkQueue();
      });
  }
  checkQueue() {
    if (this._running < this.concurrency) this.runNext();
  }
  add(func) {
    return new Promise((resolve, reject) => {
      this._queue.push({ func, resolve, reject });
      this.checkQueue();
    });
  }
};

// node_modules/yahoo-finance2/dist/esm/src/lib/errors.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var BadRequestError = class extends Error {
  static {
    __name(this, 'BadRequestError');
  }
  constructor() {
    super(...arguments);
    this.name = 'BadRequestError';
  }
};
var HTTPError = class extends Error {
  static {
    __name(this, 'HTTPError');
  }
  constructor() {
    super(...arguments);
    this.name = 'HTTPError';
  }
};
var InvalidOptionsError = class extends Error {
  static {
    __name(this, 'InvalidOptionsError');
  }
  constructor() {
    super(...arguments);
    this.name = 'InvalidOptionsError';
  }
};
var NoEnvironmentError = class extends Error {
  static {
    __name(this, 'NoEnvironmentError');
  }
  constructor() {
    super(...arguments);
    this.name = 'NoEnvironmentError';
  }
};
var FailedYahooValidationError = class extends Error {
  static {
    __name(this, 'FailedYahooValidationError');
  }
  constructor(message, { result, errors: errors2 }) {
    super(message);
    this.name = 'FailedYahooValidationError';
    this.result = result;
    this.errors = errors2;
  }
};
var errors = {
  BadRequestError,
  HTTPError,
  InvalidOptionsError,
  NoEnvironmentError,
  FailedYahooValidationError,
};
var errors_default = errors;

// node_modules/yahoo-finance2/dist/esm/package.json
var package_default = {
  name: 'yahoo-finance2',
  version: '2.14.2',
  description: 'JS API for Yahoo Finance',
  type: 'module',
  module: './dist/esm/src/index-node.js',
  main: './dist/cjs/src/index-node.js',
  exports: {
    import: './dist/esm/src/index-node.js',
    default: './dist/cjs/src/index-node.js',
  },
  types: './dist/esm/src/index-node.d.ts',
  browser: './dist/esm/src/index-browser.js',
  repository: 'https://github.com/gadicc/node-yahoo-finance2',
  author: 'Gadi Cohen <dragon@wastelands.net>',
  license: 'MIT',
  keywords: [
    'yahoo',
    'finance',
    'financial',
    'data',
    'stock',
    'price',
    'quote',
    'historical',
    'eod',
    'end-of-day',
    'client',
    'library',
  ],
  engines: {
    node: '>=18.0.0',
  },
  bin: {
    'yahoo-finance': 'bin/yahoo-finance.js',
  },
  scripts: {
    coverage: 'yarn test --coverage',
    lint: 'eslint . --ext .js,.ts',
    timeseries: 'node --loader ts-node/esm scripts/timeseries.js',
    build: 'yarn run build:esm && yarn run build:cjs',
    'build:esm': 'tsc --module esnext --target es2019 --outDir dist/esm',
    'build:cjs': `tsc --module commonjs --target es2015 --outDir dist/cjs && sed 's/"type": "module",/"type:": "commonjs",/' dist/cjs/package.json > dist/cjs/package-changed.json && mv dist/cjs/package-changed.json dist/cjs/package.json`,
    prepublishOnly: 'yarn build',
    test: 'node --experimental-vm-modules ./node_modules/jest/bin/jest.js',
    'test:ts': 'tsc --noEmit',
    'test:esm':
      'node --experimental-vm-modules ./node_modules/jest/bin/jest.js -c tests-modules/esm/jest.config.js tests-modules/esm/tests/*',
    'test:cjs':
      'node ./node_modules/jest/bin/jest.js -c tests-modules/cjs/jest.config.js tests-modules/cjs/tests/*',
    'test:modules': 'yarn test:esm && yarn test:cjs',
    'test:build': 'yarn test:modules',
  },
  files: ['dist'],
  dependencies: {
    '@sinclair/typebox': '^0.32.27',
    '@types/tough-cookie': '^4.0.2',
    'tough-cookie': '^4.1.2',
    'tough-cookie-file-store': '^2.0.3',
  },
  devDependencies: {
    '@semantic-release/changelog': '6.0.3',
    '@semantic-release/commit-analyzer': '9.0.2',
    '@semantic-release/git': '10.0.1',
    '@semantic-release/github': '8.1.0',
    '@semantic-release/npm': '9.0.2',
    '@semantic-release/release-notes-generator': '10.0.3',
    '@swc/core': '^1.7.26',
    '@swc/helpers': '^0.5.13',
    '@swc/jest': '^0.2.36',
    '@tsconfig/node12': '12.1.4',
    '@types/har-format': '^1.2.15',
    '@types/jest': '^29.5.13',
    '@typescript-eslint/eslint-plugin': '5.62.0',
    '@typescript-eslint/parser': '5.62.0',
    eslint: '8.57.1',
    'eslint-config-prettier': '^9.1.0',
    jest: '^29.7.0',
    'jest-tobetype': '1.2.3',
    prettier: '^3.3.3',
    'semantic-release': '19.0.5',
    'ts-node': '10.9.2',
    typescript: '5.7.2',
  },
};

// node_modules/yahoo-finance2/dist/esm/src/lib/getCrumb.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var import_tough_cookie2 = __toESM(require_cookie(), 1);

// node_modules/yahoo-finance2/dist/esm/src/lib/notices.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/options.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/cookieJar.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var import_tough_cookie = __toESM(require_cookie(), 1);
var ExtendedCookieJar = class extends import_tough_cookie.CookieJar {
  static {
    __name(this, 'ExtendedCookieJar');
  }
  async setFromSetCookieHeaders(setCookieHeader, url) {
    let cookies;
    if (typeof setCookieHeader === 'undefined') {
    } else if (setCookieHeader instanceof Array) {
      cookies = setCookieHeader.map((header) =>
        import_tough_cookie.Cookie.parse(header)
      );
    } else if (typeof setCookieHeader === 'string') {
      cookies = [import_tough_cookie.Cookie.parse(setCookieHeader)];
    }
    if (cookies) {
      for (const cookie of cookies)
        if (cookie instanceof import_tough_cookie.Cookie) {
          await this.setCookie(cookie, url);
        }
    }
  }
};

// node_modules/yahoo-finance2/dist/esm/src/lib/options.js
var LoggerSchema = Type.Object({
  info: Type.Function([], Type.Void()),
  warn: Type.Function([], Type.Void()),
  error: Type.Function([], Type.Void()),
  debug: Type.Function([], Type.Void()),
});
var ValidationOptionsSchema = Type.Object({
  logErrors: Type.Optional(Type.Boolean()),
  logOptionsErrors: Type.Optional(Type.Boolean()),
  _internalThrowOnAdditionalProperties: Type.Optional(
    Type.Boolean({
      default: false,
      description:
        'Use this property to throw when properties beyond what is explicitly specified in the schema are provided. It is an internal option and subject to change, use at your own risk',
    })
  ),
});
var YahooFinanceOptionsSchema = Type.Object(
  {
    YF_QUERY_HOST: Type.Optional(Type.String()),
    cookieJar: Type.Optional(Type.Any()),
    queue: Type.Optional(QueueOptionsSchema),
    validation: Type.Optional(ValidationOptionsSchema),
    logger: Type.Optional(LoggerSchema),
  },
  { title: 'YahooFinanceOptions' }
);
var options = {
  YF_QUERY_HOST: process.env.YF_QUERY_HOST || 'query2.finance.yahoo.com',
  cookieJar: new ExtendedCookieJar(),
  queue: {
    concurrency: 4,
    // Min: 1, Max: Infinity
    timeout: 60,
  },
  validation: {
    logErrors: true,
    logOptionsErrors: true,
  },
  logger: {
    info: /* @__PURE__ */ __name((...args) => console.log(...args), 'info'),
    warn: /* @__PURE__ */ __name((...args) => console.warn(...args), 'warn'),
    error: /* @__PURE__ */ __name((...args) => console.error(...args), 'error'),
    debug: /* @__PURE__ */ __name((...args) => console.log(...args), 'debug'),
  },
};
var options_default = options;

// node_modules/yahoo-finance2/dist/esm/src/lib/notices.js
var logger = options_default.logger || console;
var notices = {
  yahooSurvey: {
    id: 'yahooSurvey',
    text: "Please consider completing the survey at https://bit.ly/yahoo-finance-api-feedback if you haven't already; for more info see https://github.com/gadicc/node-yahoo-finance2/issues/764#issuecomment-2056623851.",
    onceOnly: true,
  },
  ripHistorical: {
    id: 'ripHistorical',
    text: "[Deprecated] historical() relies on an API that Yahoo have removed.  We'll map this request to chart() for convenience, but, please consider using chart() directly instead; for more info see https://github.com/gadicc/node-yahoo-finance2/issues/795.",
    level: 'warn',
    onceOnly: true,
  },
};
function showNotice(id) {
  const n = notices[id];
  if (!n) throw new Error(`Unknown notice id: ${id}`);
  if (n.suppress) return;
  if (n.onceOnly) n.suppress = true;
  const text =
    n.text +
    (n.onceOnly ? '  This will only be shown once, but you' : 'You') +
    " can suppress this message in future with `yahooFinance.suppressNotices(['" +
    id +
    "'])`.";
  const level = n.level || 'info';
  logger[level](text);
}
__name(showNotice, 'showNotice');
function suppressNotices(noticeIds) {
  noticeIds.forEach((id) => {
    const n = notices[id];
    if (!n) logger.error(`Unknown notice id: ${id}`);
    n.suppress = true;
  });
}
__name(suppressNotices, 'suppressNotices');

// node_modules/yahoo-finance2/dist/esm/src/lib/getCrumb.js
var CONFIG_FAKE_URL = 'http://config.yf2/';
var crumb = null;
var parseHtmlEntities = /* @__PURE__ */ __name(
  (str) =>
    str.replace(/&#x([0-9A-Fa-f]{1,3});/gi, (_, numStr) =>
      String.fromCharCode(parseInt(numStr, 16))
    ),
  'parseHtmlEntities'
);
async function _getCrumb(
  cookieJar,
  fetch2,
  fetchOptionsBase,
  logger2,
  url = 'https://finance.yahoo.com/quote/AAPL',
  develOverride = 'getCrumb-quote-AAPL.json',
  noCache = false
) {
  if (!crumb) {
    const cookies = await cookieJar.getCookies(CONFIG_FAKE_URL);
    for (const cookie2 of cookies) {
      if (cookie2.key === 'crumb') {
        crumb = cookie2.value;
        logger2.debug('Retrieved crumb from cookie store: ' + crumb);
        break;
      }
    }
  }
  if (crumb && !noCache) {
    const existingCookies = await cookieJar.getCookies(url, { expire: true });
    if (existingCookies.length) return crumb;
  }
  async function processSetCookieHeader(header, url2) {
    if (header) {
      await cookieJar.setFromSetCookieHeaders(header, url2);
      return true;
    }
    return false;
  }
  __name(processSetCookieHeader, 'processSetCookieHeader');
  logger2.debug('Fetching crumb and cookies from ' + url + '...');
  const fetchOptions = {
    ...fetchOptionsBase,
    headers: {
      ...fetchOptionsBase.headers,
      // NB, we won't get a set-cookie header back without this:
      accept: 'text/html,application/xhtml+xml,application/xml',
      // This request will get our first cookies, so nothing to send.
      // cookie: await cookieJar.getCookieString(url),
    },
    redirect: 'manual',
    devel: fetchOptionsBase.devel && develOverride,
  };
  const response = await fetch2(url, fetchOptions);
  await processSetCookieHeader(response.headers.getSetCookie(), url);
  const location = response.headers.get('location');
  if (location) {
    if (location.match(/guce.yahoo/)) {
      const consentFetchOptions = {
        ...fetchOptions,
        headers: {
          ...fetchOptions.headers,
          // GUCS=XXXXXXXX; Max-Age=1800; Domain=.yahoo.com; Path=/; Secure
          cookie: await cookieJar.getCookieString(location),
        },
        devel: 'getCrumb-quote-AAPL-consent.html',
      };
      logger2.debug(
        'fetch',
        location
        /*, consentFetchOptions */
      );
      const consentResponse = await fetch2(location, consentFetchOptions);
      const consentLocation = consentResponse.headers.get('location');
      if (consentLocation) {
        if (!consentLocation.match(/collectConsent/))
          throw new Error('Unexpected redirect to ' + consentLocation);
        const collectConsentFetchOptions = {
          ...consentFetchOptions,
          headers: {
            ...fetchOptions.headers,
            cookie: await cookieJar.getCookieString(consentLocation),
          },
          devel: 'getCrumb-quote-AAPL-collectConsent.html',
        };
        logger2.debug(
          'fetch',
          consentLocation
          /*, collectConsentFetchOptions */
        );
        const collectConsentResponse = await fetch2(
          consentLocation,
          collectConsentFetchOptions
        );
        const collectConsentBody = await collectConsentResponse.text();
        const collectConsentResponseParams =
          [
            ...collectConsentBody.matchAll(
              /<input type="hidden" name="([^"]+)" value="([^"]+)">/g
            ),
          ]
            .map(
              ([, name, value]) =>
                `${name}=${encodeURIComponent(parseHtmlEntities(value))}&`
            )
            .join('') + 'agree=agree&agree=agree';
        const collectConsentSubmitFetchOptions = {
          ...consentFetchOptions,
          headers: {
            ...fetchOptions.headers,
            cookie: await cookieJar.getCookieString(consentLocation),
            'content-type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
          // body: "csrfToken=XjJfOYU&sessionId=3_cc-session_bd9a3b0c-c1b4-4aa8-8c18-7a82ec68a5d5&originalDoneUrl=https%3A%2F%2Ffinance.yahoo.com%2Fquote%2FAAPL%3Fguccounter%3D1&namespace=yahoo&agree=agree&agree=agree",
          body: collectConsentResponseParams,
          devel: 'getCrumb-quote-AAPL-collectConsentSubmit',
        };
        logger2.debug(
          'fetch',
          consentLocation
          /*, collectConsentSubmitFetchOptions */
        );
        const collectConsentSubmitResponse = await fetch2(
          consentLocation,
          collectConsentSubmitFetchOptions
        );
        if (
          !(await processSetCookieHeader(
            collectConsentSubmitResponse.headers.getSetCookie(),
            consentLocation
          ))
        )
          throw new Error(
            'No set-cookie header on collectConsentSubmitResponse, please report.'
          );
        const collectConsentSubmitResponseLocation =
          collectConsentSubmitResponse.headers.get('location');
        if (!collectConsentSubmitResponseLocation)
          throw new Error(
            'collectConsentSubmitResponse unexpectedly did not return a Location header, please report.'
          );
        const copyConsentFetchOptions = {
          ...consentFetchOptions,
          headers: {
            ...fetchOptions.headers,
            cookie: await cookieJar.getCookieString(
              collectConsentSubmitResponseLocation
            ),
          },
          devel: 'getCrumb-quote-AAPL-copyConsent',
        };
        logger2.debug(
          'fetch',
          collectConsentSubmitResponseLocation
          /*, copyConsentFetchOptions */
        );
        const copyConsentResponse = await fetch2(
          collectConsentSubmitResponseLocation,
          copyConsentFetchOptions
        );
        if (
          !(await processSetCookieHeader(
            copyConsentResponse.headers.getSetCookie(),
            collectConsentSubmitResponseLocation
          ))
        )
          throw new Error(
            'No set-cookie header on copyConsentResponse, please report.'
          );
        const copyConsentResponseLocation =
          copyConsentResponse.headers.get('location');
        if (!copyConsentResponseLocation)
          throw new Error(
            'collectConsentSubmitResponse unexpectedly did not return a Location header, please report.'
          );
        const finalResponseFetchOptions = {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            cookie: await cookieJar.getCookieString(
              collectConsentSubmitResponseLocation
            ),
          },
          devel: 'getCrumb-quote-AAPL-consent-final-redirect.html',
        };
        return await _getCrumb(
          cookieJar,
          fetch2,
          finalResponseFetchOptions,
          logger2,
          copyConsentResponseLocation,
          'getCrumb-quote-AAPL-consent-final-redirect.html',
          noCache
        );
      }
    } else {
      console.error(
        'We expected a redirect to guce.yahoo.com, but got ' + location
      );
      console.error(
        "We'll try to continue anyway - you can safely ignore this if the request succeeds"
      );
    }
  }
  const cookie = (await cookieJar.getCookies(url, { expire: true }))[0];
  if (cookie) {
    logger2.debug('Success. Cookie expires on ' + cookie.expires);
  } else {
    throw new Error(
      "No set-cookie header present in Yahoo's response.  Something must have changed, please report."
    );
  }
  const GET_CRUMB_URL = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
  const getCrumbOptions = {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      // Big thanks to @nocodehummel who figured out a User-Agent that both
      // works but still allows us to identify ourselves honestly.
      'User-Agent': `Mozilla/5.0 (compatible; ${package_default.name}/${package_default.version})`,
      cookie: await cookieJar.getCookieString(GET_CRUMB_URL),
      origin: 'https://finance.yahoo.com',
      referer: url,
      accept: '*/*',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'text/plain',
    },
    devel: 'getCrumb-getcrumb',
  };
  logger2.debug(
    'fetch',
    GET_CRUMB_URL
    /*, getCrumbOptions */
  );
  const getCrumbResponse = await fetch2(GET_CRUMB_URL, getCrumbOptions);
  if (getCrumbResponse.status !== 200) {
    throw new Error(
      'Failed to get crumb, status ' +
        getCrumbResponse.status +
        ', statusText: ' +
        getCrumbResponse.statusText
    );
  }
  const crumbFromGetCrumb = await getCrumbResponse.text();
  crumb = crumbFromGetCrumb;
  if (!crumb)
    throw new Error(
      "Could not find crumb.  Yahoo's API may have changed; please report."
    );
  logger2.debug('New crumb: ' + crumb);
  await cookieJar.setCookie(
    new import_tough_cookie2.Cookie({
      key: 'crumb',
      value: crumb,
    }),
    CONFIG_FAKE_URL
  );
  promise = null;
  return crumb;
}
__name(_getCrumb, '_getCrumb');
var promise = null;
function getCrumb(
  cookieJar,
  fetch2,
  fetchOptionsBase,
  logger2,
  url = 'https://finance.yahoo.com/quote/AAPL',
  __getCrumb = _getCrumb
) {
  showNotice('yahooSurvey');
  if (!promise)
    promise = __getCrumb(cookieJar, fetch2, fetchOptionsBase, logger2, url);
  return promise;
}
__name(getCrumb, 'getCrumb');

// node_modules/yahoo-finance2/dist/esm/src/lib/yahooFinanceFetch.js
var userAgent = `${package_default.name}/${package_default.version} (+${package_default.repository})`;
var _queue = new Queue();
function assertQueueOptions(queue, opts) {
  opts;
  if (
    typeof opts.concurrency === 'number' &&
    queue.concurrency !== opts.concurrency
  )
    queue.concurrency = opts.concurrency;
  if (typeof opts.timeout === 'number' && queue.timeout !== opts.timeout)
    queue.timeout = opts.timeout;
}
__name(assertQueueOptions, 'assertQueueOptions');
function substituteVariables(urlBase) {
  return urlBase.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    if (varName === 'YF_QUERY_HOST') {
      return this._opts.YF_QUERY_HOST || 'query2.finance.yahoo.com';
    } else {
      return match;
    }
  });
}
__name(substituteVariables, 'substituteVariables');
async function yahooFinanceFetch(
  urlBase,
  params = {},
  moduleOpts = {},
  func = 'json',
  needsCrumb = false
) {
  var _a;
  if (!(this && this._env))
    throw new errors_default.NoEnvironmentError(
      'yahooFinanceFetch called without this._env set'
    );
  const queue = _queue;
  assertQueueOptions(queue, { ...this._opts.queue, ...moduleOpts.queue });
  const {
    URLSearchParams: URLSearchParams2,
    fetch: fetch2,
    fetchDevel,
  } = this._env;
  const fetchFunc = moduleOpts.devel ? await fetchDevel() : fetch2;
  const fetchOptionsBase = {
    ...moduleOpts.fetchOptions,
    devel: moduleOpts.devel,
    headers: {
      'User-Agent': userAgent,
      ...((_a = moduleOpts.fetchOptions) === null || _a === void 0
        ? void 0
        : _a.headers),
    },
  };
  if (needsCrumb) {
    if (!this._opts.cookieJar) throw new Error('No cookieJar set');
    if (!this._opts.logger) throw new Error('Logger was unset.');
    const crumb2 = await getCrumb(
      this._opts.cookieJar,
      fetchFunc,
      fetchOptionsBase,
      this._opts.logger
    );
    if (crumb2) params.crumb = crumb2;
  }
  const urlSearchParams = new URLSearchParams2(params);
  const url =
    substituteVariables.call(this, urlBase) + '?' + urlSearchParams.toString();
  if (!this._opts.cookieJar) throw new Error('No cookieJar set');
  const fetchOptions = {
    ...fetchOptionsBase,
    headers: {
      ...fetchOptionsBase.headers,
      cookie: await this._opts.cookieJar.getCookieString(url, {
        allPaths: true,
      }),
    },
  };
  if (func === 'csv') func = 'text';
  const response = await queue.add(() => fetchFunc(url, fetchOptions));
  const setCookieHeaders = response.headers.getSetCookie();
  if (setCookieHeaders) {
    if (!this._opts.cookieJar) throw new Error('No cookieJar set');
    this._opts.cookieJar.setFromSetCookieHeaders(setCookieHeaders, url);
  }
  const result = await response[func]();
  if (func === 'json') {
    const keys = Object.keys(result);
    if (keys.length === 1) {
      const errorObj = result[keys[0]].error;
      if (errorObj) {
        const errorName = errorObj.code.replace(/ /g, '') + 'Error';
        const ErrorClass = errors_default[errorName] || Error;
        throw new ErrorClass(errorObj.description);
      }
    }
  }
  if (!response.ok) {
    console.error(url);
    const error3 = new errors_default.HTTPError(response.statusText);
    error3.code = response.status;
    throw error3;
  }
  return result;
}
__name(yahooFinanceFetch, 'yahooFinanceFetch');
var yahooFinanceFetch_default = yahooFinanceFetch;

// node_modules/yahoo-finance2/dist/esm/src/lib/setGlobalConfig.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/validateAndCoerceTypes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/errors/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/errors/errors.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/system/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/system/policy.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/guard/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/guard/guard.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function IsAsyncIterator4(value) {
  return IsObject4(value) && Symbol.asyncIterator in value;
}
__name(IsAsyncIterator4, 'IsAsyncIterator');
function IsIterator4(value) {
  return IsObject4(value) && Symbol.iterator in value;
}
__name(IsIterator4, 'IsIterator');
function IsStandardObject(value) {
  return (
    IsObject4(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
__name(IsStandardObject, 'IsStandardObject');
function IsPromise3(value) {
  return value instanceof Promise;
}
__name(IsPromise3, 'IsPromise');
function IsDate4(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}
__name(IsDate4, 'IsDate');
function IsTypedArray(value) {
  return ArrayBuffer.isView(value);
}
__name(IsTypedArray, 'IsTypedArray');
function IsUint8Array4(value) {
  return value instanceof globalThis.Uint8Array;
}
__name(IsUint8Array4, 'IsUint8Array');
function HasPropertyKey(value, key) {
  return key in value;
}
__name(HasPropertyKey, 'HasPropertyKey');
function IsObject4(value) {
  return value !== null && typeof value === 'object';
}
__name(IsObject4, 'IsObject');
function IsArray4(value) {
  return Array.isArray(value) && !ArrayBuffer.isView(value);
}
__name(IsArray4, 'IsArray');
function IsUndefined4(value) {
  return value === void 0;
}
__name(IsUndefined4, 'IsUndefined');
function IsNull4(value) {
  return value === null;
}
__name(IsNull4, 'IsNull');
function IsBoolean4(value) {
  return typeof value === 'boolean';
}
__name(IsBoolean4, 'IsBoolean');
function IsNumber4(value) {
  return typeof value === 'number';
}
__name(IsNumber4, 'IsNumber');
function IsInteger3(value) {
  return Number.isInteger(value);
}
__name(IsInteger3, 'IsInteger');
function IsBigInt4(value) {
  return typeof value === 'bigint';
}
__name(IsBigInt4, 'IsBigInt');
function IsString4(value) {
  return typeof value === 'string';
}
__name(IsString4, 'IsString');
function IsFunction4(value) {
  return typeof value === 'function';
}
__name(IsFunction4, 'IsFunction');
function IsSymbol4(value) {
  return typeof value === 'symbol';
}
__name(IsSymbol4, 'IsSymbol');
function IsValueType(value) {
  return (
    IsBigInt4(value) ||
    IsBoolean4(value) ||
    IsNull4(value) ||
    IsNumber4(value) ||
    IsString4(value) ||
    IsSymbol4(value) ||
    IsUndefined4(value)
  );
}
__name(IsValueType, 'IsValueType');

// node_modules/@sinclair/typebox/build/esm/system/policy.mjs
var TypeSystemPolicy;
(function (TypeSystemPolicy2) {
  TypeSystemPolicy2.ExactOptionalPropertyTypes = false;
  TypeSystemPolicy2.AllowArrayObject = false;
  TypeSystemPolicy2.AllowNaN = false;
  TypeSystemPolicy2.AllowNullVoid = false;
  function IsExactOptionalProperty(value, key) {
    return TypeSystemPolicy2.ExactOptionalPropertyTypes
      ? key in value
      : value[key] !== void 0;
  }
  __name(IsExactOptionalProperty, 'IsExactOptionalProperty');
  TypeSystemPolicy2.IsExactOptionalProperty = IsExactOptionalProperty;
  function IsObjectLike(value) {
    const isObject = IsObject4(value);
    return TypeSystemPolicy2.AllowArrayObject
      ? isObject
      : isObject && !IsArray4(value);
  }
  __name(IsObjectLike, 'IsObjectLike');
  TypeSystemPolicy2.IsObjectLike = IsObjectLike;
  function IsRecordLike(value) {
    return (
      IsObjectLike(value) &&
      !(value instanceof Date) &&
      !(value instanceof Uint8Array)
    );
  }
  __name(IsRecordLike, 'IsRecordLike');
  TypeSystemPolicy2.IsRecordLike = IsRecordLike;
  function IsNumberLike(value) {
    return TypeSystemPolicy2.AllowNaN
      ? IsNumber4(value)
      : Number.isFinite(value);
  }
  __name(IsNumberLike, 'IsNumberLike');
  TypeSystemPolicy2.IsNumberLike = IsNumberLike;
  function IsVoidLike(value) {
    const isUndefined = IsUndefined4(value);
    return TypeSystemPolicy2.AllowNullVoid
      ? isUndefined || value === null
      : isUndefined;
  }
  __name(IsVoidLike, 'IsVoidLike');
  TypeSystemPolicy2.IsVoidLike = IsVoidLike;
})(TypeSystemPolicy || (TypeSystemPolicy = {}));

// node_modules/@sinclair/typebox/build/esm/system/system.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TypeSystemDuplicateTypeKind = class extends TypeBoxError {
  static {
    __name(this, 'TypeSystemDuplicateTypeKind');
  }
  constructor(kind) {
    super(`Duplicate type kind '${kind}' detected`);
  }
};
var TypeSystemDuplicateFormat = class extends TypeBoxError {
  static {
    __name(this, 'TypeSystemDuplicateFormat');
  }
  constructor(kind) {
    super(`Duplicate string format '${kind}' detected`);
  }
};
var TypeSystem;
(function (TypeSystem2) {
  function Type2(kind, check) {
    if (type_exports2.Has(kind)) throw new TypeSystemDuplicateTypeKind(kind);
    type_exports2.Set(kind, check);
    return (options3 = {}) => Unsafe({ ...options3, [Kind]: kind });
  }
  __name(Type2, 'Type');
  TypeSystem2.Type = Type2;
  function Format2(format, check) {
    if (format_exports.Has(format)) throw new TypeSystemDuplicateFormat(format);
    format_exports.Set(format, check);
    return format;
  }
  __name(Format2, 'Format');
  TypeSystem2.Format = Format2;
})(TypeSystem || (TypeSystem = {}));

// node_modules/@sinclair/typebox/build/esm/errors/function.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function DefaultErrorFunction(error3) {
  switch (error3.errorType) {
    case ValueErrorType.ArrayContains:
      return 'Expected array to contain at least one matching value';
    case ValueErrorType.ArrayMaxContains:
      return `Expected array to contain no more than ${error3.schema.maxContains} matching values`;
    case ValueErrorType.ArrayMinContains:
      return `Expected array to contain at least ${error3.schema.minContains} matching values`;
    case ValueErrorType.ArrayMaxItems:
      return `Expected array length to be less or equal to ${error3.schema.maxItems}`;
    case ValueErrorType.ArrayMinItems:
      return `Expected array length to be greater or equal to ${error3.schema.minItems}`;
    case ValueErrorType.ArrayUniqueItems:
      return 'Expected array elements to be unique';
    case ValueErrorType.Array:
      return 'Expected array';
    case ValueErrorType.AsyncIterator:
      return 'Expected AsyncIterator';
    case ValueErrorType.BigIntExclusiveMaximum:
      return `Expected bigint to be less than ${error3.schema.exclusiveMaximum}`;
    case ValueErrorType.BigIntExclusiveMinimum:
      return `Expected bigint to be greater than ${error3.schema.exclusiveMinimum}`;
    case ValueErrorType.BigIntMaximum:
      return `Expected bigint to be less or equal to ${error3.schema.maximum}`;
    case ValueErrorType.BigIntMinimum:
      return `Expected bigint to be greater or equal to ${error3.schema.minimum}`;
    case ValueErrorType.BigIntMultipleOf:
      return `Expected bigint to be a multiple of ${error3.schema.multipleOf}`;
    case ValueErrorType.BigInt:
      return 'Expected bigint';
    case ValueErrorType.Boolean:
      return 'Expected boolean';
    case ValueErrorType.DateExclusiveMinimumTimestamp:
      return `Expected Date timestamp to be greater than ${error3.schema.exclusiveMinimumTimestamp}`;
    case ValueErrorType.DateExclusiveMaximumTimestamp:
      return `Expected Date timestamp to be less than ${error3.schema.exclusiveMaximumTimestamp}`;
    case ValueErrorType.DateMinimumTimestamp:
      return `Expected Date timestamp to be greater or equal to ${error3.schema.minimumTimestamp}`;
    case ValueErrorType.DateMaximumTimestamp:
      return `Expected Date timestamp to be less or equal to ${error3.schema.maximumTimestamp}`;
    case ValueErrorType.DateMultipleOfTimestamp:
      return `Expected Date timestamp to be a multiple of ${error3.schema.multipleOfTimestamp}`;
    case ValueErrorType.Date:
      return 'Expected Date';
    case ValueErrorType.Function:
      return 'Expected function';
    case ValueErrorType.IntegerExclusiveMaximum:
      return `Expected integer to be less than ${error3.schema.exclusiveMaximum}`;
    case ValueErrorType.IntegerExclusiveMinimum:
      return `Expected integer to be greater than ${error3.schema.exclusiveMinimum}`;
    case ValueErrorType.IntegerMaximum:
      return `Expected integer to be less or equal to ${error3.schema.maximum}`;
    case ValueErrorType.IntegerMinimum:
      return `Expected integer to be greater or equal to ${error3.schema.minimum}`;
    case ValueErrorType.IntegerMultipleOf:
      return `Expected integer to be a multiple of ${error3.schema.multipleOf}`;
    case ValueErrorType.Integer:
      return 'Expected integer';
    case ValueErrorType.IntersectUnevaluatedProperties:
      return 'Unexpected property';
    case ValueErrorType.Intersect:
      return 'Expected all values to match';
    case ValueErrorType.Iterator:
      return 'Expected Iterator';
    case ValueErrorType.Literal:
      return `Expected ${typeof error3.schema.const === 'string' ? `'${error3.schema.const}'` : error3.schema.const}`;
    case ValueErrorType.Never:
      return 'Never';
    case ValueErrorType.Not:
      return 'Value should not match';
    case ValueErrorType.Null:
      return 'Expected null';
    case ValueErrorType.NumberExclusiveMaximum:
      return `Expected number to be less than ${error3.schema.exclusiveMaximum}`;
    case ValueErrorType.NumberExclusiveMinimum:
      return `Expected number to be greater than ${error3.schema.exclusiveMinimum}`;
    case ValueErrorType.NumberMaximum:
      return `Expected number to be less or equal to ${error3.schema.maximum}`;
    case ValueErrorType.NumberMinimum:
      return `Expected number to be greater or equal to ${error3.schema.minimum}`;
    case ValueErrorType.NumberMultipleOf:
      return `Expected number to be a multiple of ${error3.schema.multipleOf}`;
    case ValueErrorType.Number:
      return 'Expected number';
    case ValueErrorType.Object:
      return 'Expected object';
    case ValueErrorType.ObjectAdditionalProperties:
      return 'Unexpected property';
    case ValueErrorType.ObjectMaxProperties:
      return `Expected object to have no more than ${error3.schema.maxProperties} properties`;
    case ValueErrorType.ObjectMinProperties:
      return `Expected object to have at least ${error3.schema.minProperties} properties`;
    case ValueErrorType.ObjectRequiredProperty:
      return 'Expected required property';
    case ValueErrorType.Promise:
      return 'Expected Promise';
    case ValueErrorType.RegExp:
      return 'Expected string to match regular expression';
    case ValueErrorType.StringFormatUnknown:
      return `Unknown format '${error3.schema.format}'`;
    case ValueErrorType.StringFormat:
      return `Expected string to match '${error3.schema.format}' format`;
    case ValueErrorType.StringMaxLength:
      return `Expected string length less or equal to ${error3.schema.maxLength}`;
    case ValueErrorType.StringMinLength:
      return `Expected string length greater or equal to ${error3.schema.minLength}`;
    case ValueErrorType.StringPattern:
      return `Expected string to match '${error3.schema.pattern}'`;
    case ValueErrorType.String:
      return 'Expected string';
    case ValueErrorType.Symbol:
      return 'Expected symbol';
    case ValueErrorType.TupleLength:
      return `Expected tuple to have ${error3.schema.maxItems || 0} elements`;
    case ValueErrorType.Tuple:
      return 'Expected tuple';
    case ValueErrorType.Uint8ArrayMaxByteLength:
      return `Expected byte length less or equal to ${error3.schema.maxByteLength}`;
    case ValueErrorType.Uint8ArrayMinByteLength:
      return `Expected byte length greater or equal to ${error3.schema.minByteLength}`;
    case ValueErrorType.Uint8Array:
      return 'Expected Uint8Array';
    case ValueErrorType.Undefined:
      return 'Expected undefined';
    case ValueErrorType.Union:
      return 'Expected union value';
    case ValueErrorType.Void:
      return 'Expected void';
    case ValueErrorType.Kind:
      return `Expected kind '${error3.schema[Kind]}'`;
    default:
      return 'Unknown error type';
  }
}
__name(DefaultErrorFunction, 'DefaultErrorFunction');
var errorFunction = DefaultErrorFunction;
function GetErrorFunction() {
  return errorFunction;
}
__name(GetErrorFunction, 'GetErrorFunction');

// node_modules/@sinclair/typebox/build/esm/value/deref/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/deref/deref.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TypeDereferenceError = class extends TypeBoxError {
  static {
    __name(this, 'TypeDereferenceError');
  }
  constructor(schema) {
    super(`Unable to dereference schema with $id '${schema.$id}'`);
    this.schema = schema;
  }
};
function Resolve(schema, references) {
  const target = references.find((target2) => target2.$id === schema.$ref);
  if (target === void 0) throw new TypeDereferenceError(schema);
  return Deref2(target, references);
}
__name(Resolve, 'Resolve');
function Deref2(schema, references) {
  return schema[Kind] === 'This' || schema[Kind] === 'Ref'
    ? Resolve(schema, references)
    : schema;
}
__name(Deref2, 'Deref');

// node_modules/@sinclair/typebox/build/esm/value/hash/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/hash/hash.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ValueHashError = class extends TypeBoxError {
  static {
    __name(this, 'ValueHashError');
  }
  constructor(value) {
    super(`Unable to hash value`);
    this.value = value;
  }
};
var ByteMarker;
(function (ByteMarker2) {
  ByteMarker2[(ByteMarker2['Undefined'] = 0)] = 'Undefined';
  ByteMarker2[(ByteMarker2['Null'] = 1)] = 'Null';
  ByteMarker2[(ByteMarker2['Boolean'] = 2)] = 'Boolean';
  ByteMarker2[(ByteMarker2['Number'] = 3)] = 'Number';
  ByteMarker2[(ByteMarker2['String'] = 4)] = 'String';
  ByteMarker2[(ByteMarker2['Object'] = 5)] = 'Object';
  ByteMarker2[(ByteMarker2['Array'] = 6)] = 'Array';
  ByteMarker2[(ByteMarker2['Date'] = 7)] = 'Date';
  ByteMarker2[(ByteMarker2['Uint8Array'] = 8)] = 'Uint8Array';
  ByteMarker2[(ByteMarker2['Symbol'] = 9)] = 'Symbol';
  ByteMarker2[(ByteMarker2['BigInt'] = 10)] = 'BigInt';
})(ByteMarker || (ByteMarker = {}));
var Accumulator = BigInt('14695981039346656037');
var [Prime, Size] = [BigInt('1099511628211'), BigInt('2') ** BigInt('64')];
var Bytes = Array.from({ length: 256 }).map((_, i) => BigInt(i));
var F64 = new Float64Array(1);
var F64In = new DataView(F64.buffer);
var F64Out = new Uint8Array(F64.buffer);
function* NumberToBytes(value) {
  const byteCount =
    value === 0 ? 1 : Math.ceil(Math.floor(Math.log2(value) + 1) / 8);
  for (let i = 0; i < byteCount; i++) {
    yield (value >> (8 * (byteCount - 1 - i))) & 255;
  }
}
__name(NumberToBytes, 'NumberToBytes');
function ArrayType2(value) {
  FNV1A64(ByteMarker.Array);
  for (const item of value) {
    Visit4(item);
  }
}
__name(ArrayType2, 'ArrayType');
function BooleanType(value) {
  FNV1A64(ByteMarker.Boolean);
  FNV1A64(value ? 1 : 0);
}
__name(BooleanType, 'BooleanType');
function BigIntType(value) {
  FNV1A64(ByteMarker.BigInt);
  F64In.setBigInt64(0, value);
  for (const byte of F64Out) {
    FNV1A64(byte);
  }
}
__name(BigIntType, 'BigIntType');
function DateType2(value) {
  FNV1A64(ByteMarker.Date);
  Visit4(value.getTime());
}
__name(DateType2, 'DateType');
function NullType(value) {
  FNV1A64(ByteMarker.Null);
}
__name(NullType, 'NullType');
function NumberType(value) {
  FNV1A64(ByteMarker.Number);
  F64In.setFloat64(0, value);
  for (const byte of F64Out) {
    FNV1A64(byte);
  }
}
__name(NumberType, 'NumberType');
function ObjectType2(value) {
  FNV1A64(ByteMarker.Object);
  for (const key of globalThis.Object.getOwnPropertyNames(value).sort()) {
    Visit4(key);
    Visit4(value[key]);
  }
}
__name(ObjectType2, 'ObjectType');
function StringType(value) {
  FNV1A64(ByteMarker.String);
  for (let i = 0; i < value.length; i++) {
    for (const byte of NumberToBytes(value.charCodeAt(i))) {
      FNV1A64(byte);
    }
  }
}
__name(StringType, 'StringType');
function SymbolType(value) {
  FNV1A64(ByteMarker.Symbol);
  Visit4(value.description);
}
__name(SymbolType, 'SymbolType');
function Uint8ArrayType2(value) {
  FNV1A64(ByteMarker.Uint8Array);
  for (let i = 0; i < value.length; i++) {
    FNV1A64(value[i]);
  }
}
__name(Uint8ArrayType2, 'Uint8ArrayType');
function UndefinedType(value) {
  return FNV1A64(ByteMarker.Undefined);
}
__name(UndefinedType, 'UndefinedType');
function Visit4(value) {
  if (IsArray4(value)) return ArrayType2(value);
  if (IsBoolean4(value)) return BooleanType(value);
  if (IsBigInt4(value)) return BigIntType(value);
  if (IsDate4(value)) return DateType2(value);
  if (IsNull4(value)) return NullType(value);
  if (IsNumber4(value)) return NumberType(value);
  if (IsStandardObject(value)) return ObjectType2(value);
  if (IsString4(value)) return StringType(value);
  if (IsSymbol4(value)) return SymbolType(value);
  if (IsUint8Array4(value)) return Uint8ArrayType2(value);
  if (IsUndefined4(value)) return UndefinedType(value);
  throw new ValueHashError(value);
}
__name(Visit4, 'Visit');
function FNV1A64(byte) {
  Accumulator = Accumulator ^ Bytes[byte];
  Accumulator = (Accumulator * Prime) % Size;
}
__name(FNV1A64, 'FNV1A64');
function Hash(value) {
  Accumulator = BigInt('14695981039346656037');
  Visit4(value);
  return Accumulator;
}
__name(Hash, 'Hash');

// node_modules/@sinclair/typebox/build/esm/errors/errors.mjs
var ValueErrorType;
(function (ValueErrorType2) {
  ValueErrorType2[(ValueErrorType2['ArrayContains'] = 0)] = 'ArrayContains';
  ValueErrorType2[(ValueErrorType2['ArrayMaxContains'] = 1)] =
    'ArrayMaxContains';
  ValueErrorType2[(ValueErrorType2['ArrayMaxItems'] = 2)] = 'ArrayMaxItems';
  ValueErrorType2[(ValueErrorType2['ArrayMinContains'] = 3)] =
    'ArrayMinContains';
  ValueErrorType2[(ValueErrorType2['ArrayMinItems'] = 4)] = 'ArrayMinItems';
  ValueErrorType2[(ValueErrorType2['ArrayUniqueItems'] = 5)] =
    'ArrayUniqueItems';
  ValueErrorType2[(ValueErrorType2['Array'] = 6)] = 'Array';
  ValueErrorType2[(ValueErrorType2['AsyncIterator'] = 7)] = 'AsyncIterator';
  ValueErrorType2[(ValueErrorType2['BigIntExclusiveMaximum'] = 8)] =
    'BigIntExclusiveMaximum';
  ValueErrorType2[(ValueErrorType2['BigIntExclusiveMinimum'] = 9)] =
    'BigIntExclusiveMinimum';
  ValueErrorType2[(ValueErrorType2['BigIntMaximum'] = 10)] = 'BigIntMaximum';
  ValueErrorType2[(ValueErrorType2['BigIntMinimum'] = 11)] = 'BigIntMinimum';
  ValueErrorType2[(ValueErrorType2['BigIntMultipleOf'] = 12)] =
    'BigIntMultipleOf';
  ValueErrorType2[(ValueErrorType2['BigInt'] = 13)] = 'BigInt';
  ValueErrorType2[(ValueErrorType2['Boolean'] = 14)] = 'Boolean';
  ValueErrorType2[(ValueErrorType2['DateExclusiveMaximumTimestamp'] = 15)] =
    'DateExclusiveMaximumTimestamp';
  ValueErrorType2[(ValueErrorType2['DateExclusiveMinimumTimestamp'] = 16)] =
    'DateExclusiveMinimumTimestamp';
  ValueErrorType2[(ValueErrorType2['DateMaximumTimestamp'] = 17)] =
    'DateMaximumTimestamp';
  ValueErrorType2[(ValueErrorType2['DateMinimumTimestamp'] = 18)] =
    'DateMinimumTimestamp';
  ValueErrorType2[(ValueErrorType2['DateMultipleOfTimestamp'] = 19)] =
    'DateMultipleOfTimestamp';
  ValueErrorType2[(ValueErrorType2['Date'] = 20)] = 'Date';
  ValueErrorType2[(ValueErrorType2['Function'] = 21)] = 'Function';
  ValueErrorType2[(ValueErrorType2['IntegerExclusiveMaximum'] = 22)] =
    'IntegerExclusiveMaximum';
  ValueErrorType2[(ValueErrorType2['IntegerExclusiveMinimum'] = 23)] =
    'IntegerExclusiveMinimum';
  ValueErrorType2[(ValueErrorType2['IntegerMaximum'] = 24)] = 'IntegerMaximum';
  ValueErrorType2[(ValueErrorType2['IntegerMinimum'] = 25)] = 'IntegerMinimum';
  ValueErrorType2[(ValueErrorType2['IntegerMultipleOf'] = 26)] =
    'IntegerMultipleOf';
  ValueErrorType2[(ValueErrorType2['Integer'] = 27)] = 'Integer';
  ValueErrorType2[(ValueErrorType2['IntersectUnevaluatedProperties'] = 28)] =
    'IntersectUnevaluatedProperties';
  ValueErrorType2[(ValueErrorType2['Intersect'] = 29)] = 'Intersect';
  ValueErrorType2[(ValueErrorType2['Iterator'] = 30)] = 'Iterator';
  ValueErrorType2[(ValueErrorType2['Kind'] = 31)] = 'Kind';
  ValueErrorType2[(ValueErrorType2['Literal'] = 32)] = 'Literal';
  ValueErrorType2[(ValueErrorType2['Never'] = 33)] = 'Never';
  ValueErrorType2[(ValueErrorType2['Not'] = 34)] = 'Not';
  ValueErrorType2[(ValueErrorType2['Null'] = 35)] = 'Null';
  ValueErrorType2[(ValueErrorType2['NumberExclusiveMaximum'] = 36)] =
    'NumberExclusiveMaximum';
  ValueErrorType2[(ValueErrorType2['NumberExclusiveMinimum'] = 37)] =
    'NumberExclusiveMinimum';
  ValueErrorType2[(ValueErrorType2['NumberMaximum'] = 38)] = 'NumberMaximum';
  ValueErrorType2[(ValueErrorType2['NumberMinimum'] = 39)] = 'NumberMinimum';
  ValueErrorType2[(ValueErrorType2['NumberMultipleOf'] = 40)] =
    'NumberMultipleOf';
  ValueErrorType2[(ValueErrorType2['Number'] = 41)] = 'Number';
  ValueErrorType2[(ValueErrorType2['ObjectAdditionalProperties'] = 42)] =
    'ObjectAdditionalProperties';
  ValueErrorType2[(ValueErrorType2['ObjectMaxProperties'] = 43)] =
    'ObjectMaxProperties';
  ValueErrorType2[(ValueErrorType2['ObjectMinProperties'] = 44)] =
    'ObjectMinProperties';
  ValueErrorType2[(ValueErrorType2['ObjectRequiredProperty'] = 45)] =
    'ObjectRequiredProperty';
  ValueErrorType2[(ValueErrorType2['Object'] = 46)] = 'Object';
  ValueErrorType2[(ValueErrorType2['Promise'] = 47)] = 'Promise';
  ValueErrorType2[(ValueErrorType2['RegExp'] = 48)] = 'RegExp';
  ValueErrorType2[(ValueErrorType2['StringFormatUnknown'] = 49)] =
    'StringFormatUnknown';
  ValueErrorType2[(ValueErrorType2['StringFormat'] = 50)] = 'StringFormat';
  ValueErrorType2[(ValueErrorType2['StringMaxLength'] = 51)] =
    'StringMaxLength';
  ValueErrorType2[(ValueErrorType2['StringMinLength'] = 52)] =
    'StringMinLength';
  ValueErrorType2[(ValueErrorType2['StringPattern'] = 53)] = 'StringPattern';
  ValueErrorType2[(ValueErrorType2['String'] = 54)] = 'String';
  ValueErrorType2[(ValueErrorType2['Symbol'] = 55)] = 'Symbol';
  ValueErrorType2[(ValueErrorType2['TupleLength'] = 56)] = 'TupleLength';
  ValueErrorType2[(ValueErrorType2['Tuple'] = 57)] = 'Tuple';
  ValueErrorType2[(ValueErrorType2['Uint8ArrayMaxByteLength'] = 58)] =
    'Uint8ArrayMaxByteLength';
  ValueErrorType2[(ValueErrorType2['Uint8ArrayMinByteLength'] = 59)] =
    'Uint8ArrayMinByteLength';
  ValueErrorType2[(ValueErrorType2['Uint8Array'] = 60)] = 'Uint8Array';
  ValueErrorType2[(ValueErrorType2['Undefined'] = 61)] = 'Undefined';
  ValueErrorType2[(ValueErrorType2['Union'] = 62)] = 'Union';
  ValueErrorType2[(ValueErrorType2['Void'] = 63)] = 'Void';
})(ValueErrorType || (ValueErrorType = {}));
var ValueErrorsUnknownTypeError = class extends TypeBoxError {
  static {
    __name(this, 'ValueErrorsUnknownTypeError');
  }
  constructor(schema) {
    super('Unknown type');
    this.schema = schema;
  }
};
function EscapeKey(key) {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}
__name(EscapeKey, 'EscapeKey');
function IsDefined(value) {
  return value !== void 0;
}
__name(IsDefined, 'IsDefined');
var ValueErrorIterator = class {
  static {
    __name(this, 'ValueErrorIterator');
  }
  constructor(iterator) {
    this.iterator = iterator;
  }
  [Symbol.iterator]() {
    return this.iterator;
  }
  /** Returns the first value error or undefined if no errors */
  First() {
    const next = this.iterator.next();
    return next.done ? void 0 : next.value;
  }
};
function Create(errorType, schema, path, value) {
  return {
    type: errorType,
    schema,
    path,
    value,
    message: GetErrorFunction()({ errorType, path, schema, value }),
  };
}
__name(Create, 'Create');
function* FromAny2(schema, references, path, value) {}
__name(FromAny2, 'FromAny');
function* FromArray6(schema, references, path, value) {
  if (!IsArray4(value)) {
    return yield Create(ValueErrorType.Array, schema, path, value);
  }
  if (IsDefined(schema.minItems) && !(value.length >= schema.minItems)) {
    yield Create(ValueErrorType.ArrayMinItems, schema, path, value);
  }
  if (IsDefined(schema.maxItems) && !(value.length <= schema.maxItems)) {
    yield Create(ValueErrorType.ArrayMaxItems, schema, path, value);
  }
  for (let i = 0; i < value.length; i++) {
    yield* Visit5(schema.items, references, `${path}/${i}`, value[i]);
  }
  if (
    schema.uniqueItems === true &&
    !(function () {
      const set = /* @__PURE__ */ new Set();
      for (const element of value) {
        const hashed = Hash(element);
        if (set.has(hashed)) {
          return false;
        } else {
          set.add(hashed);
        }
      }
      return true;
    })()
  ) {
    yield Create(ValueErrorType.ArrayUniqueItems, schema, path, value);
  }
  if (
    !(
      IsDefined(schema.contains) ||
      IsDefined(schema.minContains) ||
      IsDefined(schema.maxContains)
    )
  ) {
    return;
  }
  const containsSchema = IsDefined(schema.contains) ? schema.contains : Never();
  const containsCount = value.reduce(
    (acc, value2, index) =>
      Visit5(containsSchema, references, `${path}${index}`, value2).next()
        .done === true
        ? acc + 1
        : acc,
    0
  );
  if (containsCount === 0) {
    yield Create(ValueErrorType.ArrayContains, schema, path, value);
  }
  if (IsNumber4(schema.minContains) && containsCount < schema.minContains) {
    yield Create(ValueErrorType.ArrayMinContains, schema, path, value);
  }
  if (IsNumber4(schema.maxContains) && containsCount > schema.maxContains) {
    yield Create(ValueErrorType.ArrayMaxContains, schema, path, value);
  }
}
__name(FromArray6, 'FromArray');
function* FromAsyncIterator3(schema, references, path, value) {
  if (!IsAsyncIterator4(value))
    yield Create(ValueErrorType.AsyncIterator, schema, path, value);
}
__name(FromAsyncIterator3, 'FromAsyncIterator');
function* FromBigInt2(schema, references, path, value) {
  if (!IsBigInt4(value))
    return yield Create(ValueErrorType.BigInt, schema, path, value);
  if (
    IsDefined(schema.exclusiveMaximum) &&
    !(value < schema.exclusiveMaximum)
  ) {
    yield Create(ValueErrorType.BigIntExclusiveMaximum, schema, path, value);
  }
  if (
    IsDefined(schema.exclusiveMinimum) &&
    !(value > schema.exclusiveMinimum)
  ) {
    yield Create(ValueErrorType.BigIntExclusiveMinimum, schema, path, value);
  }
  if (IsDefined(schema.maximum) && !(value <= schema.maximum)) {
    yield Create(ValueErrorType.BigIntMaximum, schema, path, value);
  }
  if (IsDefined(schema.minimum) && !(value >= schema.minimum)) {
    yield Create(ValueErrorType.BigIntMinimum, schema, path, value);
  }
  if (
    IsDefined(schema.multipleOf) &&
    !(value % schema.multipleOf === BigInt(0))
  ) {
    yield Create(ValueErrorType.BigIntMultipleOf, schema, path, value);
  }
}
__name(FromBigInt2, 'FromBigInt');
function* FromBoolean2(schema, references, path, value) {
  if (!IsBoolean4(value))
    yield Create(ValueErrorType.Boolean, schema, path, value);
}
__name(FromBoolean2, 'FromBoolean');
function* FromConstructor3(schema, references, path, value) {
  yield* Visit5(schema.returns, references, path, value.prototype);
}
__name(FromConstructor3, 'FromConstructor');
function* FromDate2(schema, references, path, value) {
  if (!IsDate4(value))
    return yield Create(ValueErrorType.Date, schema, path, value);
  if (
    IsDefined(schema.exclusiveMaximumTimestamp) &&
    !(value.getTime() < schema.exclusiveMaximumTimestamp)
  ) {
    yield Create(
      ValueErrorType.DateExclusiveMaximumTimestamp,
      schema,
      path,
      value
    );
  }
  if (
    IsDefined(schema.exclusiveMinimumTimestamp) &&
    !(value.getTime() > schema.exclusiveMinimumTimestamp)
  ) {
    yield Create(
      ValueErrorType.DateExclusiveMinimumTimestamp,
      schema,
      path,
      value
    );
  }
  if (
    IsDefined(schema.maximumTimestamp) &&
    !(value.getTime() <= schema.maximumTimestamp)
  ) {
    yield Create(ValueErrorType.DateMaximumTimestamp, schema, path, value);
  }
  if (
    IsDefined(schema.minimumTimestamp) &&
    !(value.getTime() >= schema.minimumTimestamp)
  ) {
    yield Create(ValueErrorType.DateMinimumTimestamp, schema, path, value);
  }
  if (
    IsDefined(schema.multipleOfTimestamp) &&
    !(value.getTime() % schema.multipleOfTimestamp === 0)
  ) {
    yield Create(ValueErrorType.DateMultipleOfTimestamp, schema, path, value);
  }
}
__name(FromDate2, 'FromDate');
function* FromFunction3(schema, references, path, value) {
  if (!IsFunction4(value))
    yield Create(ValueErrorType.Function, schema, path, value);
}
__name(FromFunction3, 'FromFunction');
function* FromInteger2(schema, references, path, value) {
  if (!IsInteger3(value))
    return yield Create(ValueErrorType.Integer, schema, path, value);
  if (
    IsDefined(schema.exclusiveMaximum) &&
    !(value < schema.exclusiveMaximum)
  ) {
    yield Create(ValueErrorType.IntegerExclusiveMaximum, schema, path, value);
  }
  if (
    IsDefined(schema.exclusiveMinimum) &&
    !(value > schema.exclusiveMinimum)
  ) {
    yield Create(ValueErrorType.IntegerExclusiveMinimum, schema, path, value);
  }
  if (IsDefined(schema.maximum) && !(value <= schema.maximum)) {
    yield Create(ValueErrorType.IntegerMaximum, schema, path, value);
  }
  if (IsDefined(schema.minimum) && !(value >= schema.minimum)) {
    yield Create(ValueErrorType.IntegerMinimum, schema, path, value);
  }
  if (IsDefined(schema.multipleOf) && !(value % schema.multipleOf === 0)) {
    yield Create(ValueErrorType.IntegerMultipleOf, schema, path, value);
  }
}
__name(FromInteger2, 'FromInteger');
function* FromIntersect8(schema, references, path, value) {
  for (const inner of schema.allOf) {
    const next = Visit5(inner, references, path, value).next();
    if (!next.done) {
      yield Create(ValueErrorType.Intersect, schema, path, value);
      yield next.value;
    }
  }
  if (schema.unevaluatedProperties === false) {
    const keyCheck = new RegExp(KeyOfPattern(schema));
    for (const valueKey of Object.getOwnPropertyNames(value)) {
      if (!keyCheck.test(valueKey)) {
        yield Create(
          ValueErrorType.IntersectUnevaluatedProperties,
          schema,
          `${path}/${valueKey}`,
          value
        );
      }
    }
  }
  if (typeof schema.unevaluatedProperties === 'object') {
    const keyCheck = new RegExp(KeyOfPattern(schema));
    for (const valueKey of Object.getOwnPropertyNames(value)) {
      if (!keyCheck.test(valueKey)) {
        const next = Visit5(
          schema.unevaluatedProperties,
          references,
          `${path}/${valueKey}`,
          value[valueKey]
        ).next();
        if (!next.done) yield next.value;
      }
    }
  }
}
__name(FromIntersect8, 'FromIntersect');
function* FromIterator3(schema, references, path, value) {
  if (!IsIterator4(value))
    yield Create(ValueErrorType.Iterator, schema, path, value);
}
__name(FromIterator3, 'FromIterator');
function* FromLiteral3(schema, references, path, value) {
  if (!(value === schema.const))
    yield Create(ValueErrorType.Literal, schema, path, value);
}
__name(FromLiteral3, 'FromLiteral');
function* FromNever2(schema, references, path, value) {
  yield Create(ValueErrorType.Never, schema, path, value);
}
__name(FromNever2, 'FromNever');
function* FromNot2(schema, references, path, value) {
  if (Visit5(schema.not, references, path, value).next().done === true)
    yield Create(ValueErrorType.Not, schema, path, value);
}
__name(FromNot2, 'FromNot');
function* FromNull2(schema, references, path, value) {
  if (!IsNull4(value)) yield Create(ValueErrorType.Null, schema, path, value);
}
__name(FromNull2, 'FromNull');
function* FromNumber2(schema, references, path, value) {
  if (!TypeSystemPolicy.IsNumberLike(value))
    return yield Create(ValueErrorType.Number, schema, path, value);
  if (
    IsDefined(schema.exclusiveMaximum) &&
    !(value < schema.exclusiveMaximum)
  ) {
    yield Create(ValueErrorType.NumberExclusiveMaximum, schema, path, value);
  }
  if (
    IsDefined(schema.exclusiveMinimum) &&
    !(value > schema.exclusiveMinimum)
  ) {
    yield Create(ValueErrorType.NumberExclusiveMinimum, schema, path, value);
  }
  if (IsDefined(schema.maximum) && !(value <= schema.maximum)) {
    yield Create(ValueErrorType.NumberMaximum, schema, path, value);
  }
  if (IsDefined(schema.minimum) && !(value >= schema.minimum)) {
    yield Create(ValueErrorType.NumberMinimum, schema, path, value);
  }
  if (IsDefined(schema.multipleOf) && !(value % schema.multipleOf === 0)) {
    yield Create(ValueErrorType.NumberMultipleOf, schema, path, value);
  }
}
__name(FromNumber2, 'FromNumber');
function* FromObject3(schema, references, path, value) {
  if (!TypeSystemPolicy.IsObjectLike(value))
    return yield Create(ValueErrorType.Object, schema, path, value);
  if (
    IsDefined(schema.minProperties) &&
    !(Object.getOwnPropertyNames(value).length >= schema.minProperties)
  ) {
    yield Create(ValueErrorType.ObjectMinProperties, schema, path, value);
  }
  if (
    IsDefined(schema.maxProperties) &&
    !(Object.getOwnPropertyNames(value).length <= schema.maxProperties)
  ) {
    yield Create(ValueErrorType.ObjectMaxProperties, schema, path, value);
  }
  const requiredKeys = Array.isArray(schema.required) ? schema.required : [];
  const knownKeys = Object.getOwnPropertyNames(schema.properties);
  const unknownKeys = Object.getOwnPropertyNames(value);
  for (const requiredKey of requiredKeys) {
    if (unknownKeys.includes(requiredKey)) continue;
    yield Create(
      ValueErrorType.ObjectRequiredProperty,
      schema.properties[requiredKey],
      `${path}/${EscapeKey(requiredKey)}`,
      void 0
    );
  }
  if (schema.additionalProperties === false) {
    for (const valueKey of unknownKeys) {
      if (!knownKeys.includes(valueKey)) {
        yield Create(
          ValueErrorType.ObjectAdditionalProperties,
          schema,
          `${path}/${EscapeKey(valueKey)}`,
          value[valueKey]
        );
      }
    }
  }
  if (typeof schema.additionalProperties === 'object') {
    for (const valueKey of unknownKeys) {
      if (knownKeys.includes(valueKey)) continue;
      yield* Visit5(
        schema.additionalProperties,
        references,
        `${path}/${EscapeKey(valueKey)}`,
        value[valueKey]
      );
    }
  }
  for (const knownKey of knownKeys) {
    const property = schema.properties[knownKey];
    if (schema.required && schema.required.includes(knownKey)) {
      yield* Visit5(
        property,
        references,
        `${path}/${EscapeKey(knownKey)}`,
        value[knownKey]
      );
      if (ExtendsUndefinedCheck(schema) && !(knownKey in value)) {
        yield Create(
          ValueErrorType.ObjectRequiredProperty,
          property,
          `${path}/${EscapeKey(knownKey)}`,
          void 0
        );
      }
    } else {
      if (TypeSystemPolicy.IsExactOptionalProperty(value, knownKey)) {
        yield* Visit5(
          property,
          references,
          `${path}/${EscapeKey(knownKey)}`,
          value[knownKey]
        );
      }
    }
  }
}
__name(FromObject3, 'FromObject');
function* FromPromise4(schema, references, path, value) {
  if (!IsPromise3(value))
    yield Create(ValueErrorType.Promise, schema, path, value);
}
__name(FromPromise4, 'FromPromise');
function* FromRecord2(schema, references, path, value) {
  if (!TypeSystemPolicy.IsRecordLike(value))
    return yield Create(ValueErrorType.Object, schema, path, value);
  if (
    IsDefined(schema.minProperties) &&
    !(Object.getOwnPropertyNames(value).length >= schema.minProperties)
  ) {
    yield Create(ValueErrorType.ObjectMinProperties, schema, path, value);
  }
  if (
    IsDefined(schema.maxProperties) &&
    !(Object.getOwnPropertyNames(value).length <= schema.maxProperties)
  ) {
    yield Create(ValueErrorType.ObjectMaxProperties, schema, path, value);
  }
  const [patternKey, patternSchema] = Object.entries(
    schema.patternProperties
  )[0];
  const regex = new RegExp(patternKey);
  for (const [propertyKey, propertyValue] of Object.entries(value)) {
    if (regex.test(propertyKey))
      yield* Visit5(
        patternSchema,
        references,
        `${path}/${EscapeKey(propertyKey)}`,
        propertyValue
      );
  }
  if (typeof schema.additionalProperties === 'object') {
    for (const [propertyKey, propertyValue] of Object.entries(value)) {
      if (!regex.test(propertyKey))
        yield* Visit5(
          schema.additionalProperties,
          references,
          `${path}/${EscapeKey(propertyKey)}`,
          propertyValue
        );
    }
  }
  if (schema.additionalProperties === false) {
    for (const [propertyKey, propertyValue] of Object.entries(value)) {
      if (regex.test(propertyKey)) continue;
      return yield Create(
        ValueErrorType.ObjectAdditionalProperties,
        schema,
        `${path}/${EscapeKey(propertyKey)}`,
        propertyValue
      );
    }
  }
}
__name(FromRecord2, 'FromRecord');
function* FromRef2(schema, references, path, value) {
  yield* Visit5(Deref2(schema, references), references, path, value);
}
__name(FromRef2, 'FromRef');
function* FromRegExp2(schema, references, path, value) {
  if (!IsString4(value))
    return yield Create(ValueErrorType.String, schema, path, value);
  if (IsDefined(schema.minLength) && !(value.length >= schema.minLength)) {
    yield Create(ValueErrorType.StringMinLength, schema, path, value);
  }
  if (IsDefined(schema.maxLength) && !(value.length <= schema.maxLength)) {
    yield Create(ValueErrorType.StringMaxLength, schema, path, value);
  }
  const regex = new RegExp(schema.source, schema.flags);
  if (!regex.test(value)) {
    return yield Create(ValueErrorType.RegExp, schema, path, value);
  }
}
__name(FromRegExp2, 'FromRegExp');
function* FromString2(schema, references, path, value) {
  if (!IsString4(value))
    return yield Create(ValueErrorType.String, schema, path, value);
  if (IsDefined(schema.minLength) && !(value.length >= schema.minLength)) {
    yield Create(ValueErrorType.StringMinLength, schema, path, value);
  }
  if (IsDefined(schema.maxLength) && !(value.length <= schema.maxLength)) {
    yield Create(ValueErrorType.StringMaxLength, schema, path, value);
  }
  if (IsString4(schema.pattern)) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      yield Create(ValueErrorType.StringPattern, schema, path, value);
    }
  }
  if (IsString4(schema.format)) {
    if (!format_exports.Has(schema.format)) {
      yield Create(ValueErrorType.StringFormatUnknown, schema, path, value);
    } else {
      const format = format_exports.Get(schema.format);
      if (!format(value)) {
        yield Create(ValueErrorType.StringFormat, schema, path, value);
      }
    }
  }
}
__name(FromString2, 'FromString');
function* FromSymbol2(schema, references, path, value) {
  if (!IsSymbol4(value))
    yield Create(ValueErrorType.Symbol, schema, path, value);
}
__name(FromSymbol2, 'FromSymbol');
function* FromTemplateLiteral4(schema, references, path, value) {
  if (!IsString4(value))
    return yield Create(ValueErrorType.String, schema, path, value);
  const regex = new RegExp(schema.pattern);
  if (!regex.test(value)) {
    yield Create(ValueErrorType.StringPattern, schema, path, value);
  }
}
__name(FromTemplateLiteral4, 'FromTemplateLiteral');
function* FromThis(schema, references, path, value) {
  yield* Visit5(Deref2(schema, references), references, path, value);
}
__name(FromThis, 'FromThis');
function* FromTuple5(schema, references, path, value) {
  if (!IsArray4(value))
    return yield Create(ValueErrorType.Tuple, schema, path, value);
  if (schema.items === void 0 && !(value.length === 0)) {
    return yield Create(ValueErrorType.TupleLength, schema, path, value);
  }
  if (!(value.length === schema.maxItems)) {
    return yield Create(ValueErrorType.TupleLength, schema, path, value);
  }
  if (!schema.items) {
    return;
  }
  for (let i = 0; i < schema.items.length; i++) {
    yield* Visit5(schema.items[i], references, `${path}/${i}`, value[i]);
  }
}
__name(FromTuple5, 'FromTuple');
function* FromUndefined2(schema, references, path, value) {
  if (!IsUndefined4(value))
    yield Create(ValueErrorType.Undefined, schema, path, value);
}
__name(FromUndefined2, 'FromUndefined');
function* FromUnion10(schema, references, path, value) {
  let count3 = 0;
  for (const subschema of schema.anyOf) {
    const errors2 = [...Visit5(subschema, references, path, value)];
    if (errors2.length === 0) return;
    count3 += errors2.length;
  }
  if (count3 > 0) {
    yield Create(ValueErrorType.Union, schema, path, value);
  }
}
__name(FromUnion10, 'FromUnion');
function* FromUint8Array2(schema, references, path, value) {
  if (!IsUint8Array4(value))
    return yield Create(ValueErrorType.Uint8Array, schema, path, value);
  if (
    IsDefined(schema.maxByteLength) &&
    !(value.length <= schema.maxByteLength)
  ) {
    yield Create(ValueErrorType.Uint8ArrayMaxByteLength, schema, path, value);
  }
  if (
    IsDefined(schema.minByteLength) &&
    !(value.length >= schema.minByteLength)
  ) {
    yield Create(ValueErrorType.Uint8ArrayMinByteLength, schema, path, value);
  }
}
__name(FromUint8Array2, 'FromUint8Array');
function* FromUnknown2(schema, references, path, value) {}
__name(FromUnknown2, 'FromUnknown');
function* FromVoid2(schema, references, path, value) {
  if (!TypeSystemPolicy.IsVoidLike(value))
    yield Create(ValueErrorType.Void, schema, path, value);
}
__name(FromVoid2, 'FromVoid');
function* FromKind(schema, references, path, value) {
  const check = type_exports2.Get(schema[Kind]);
  if (!check(schema, value))
    yield Create(ValueErrorType.Kind, schema, path, value);
}
__name(FromKind, 'FromKind');
function* Visit5(schema, references, path, value) {
  const references_ = IsDefined(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema_[Kind]) {
    case 'Any':
      return yield* FromAny2(schema_, references_, path, value);
    case 'Array':
      return yield* FromArray6(schema_, references_, path, value);
    case 'AsyncIterator':
      return yield* FromAsyncIterator3(schema_, references_, path, value);
    case 'BigInt':
      return yield* FromBigInt2(schema_, references_, path, value);
    case 'Boolean':
      return yield* FromBoolean2(schema_, references_, path, value);
    case 'Constructor':
      return yield* FromConstructor3(schema_, references_, path, value);
    case 'Date':
      return yield* FromDate2(schema_, references_, path, value);
    case 'Function':
      return yield* FromFunction3(schema_, references_, path, value);
    case 'Integer':
      return yield* FromInteger2(schema_, references_, path, value);
    case 'Intersect':
      return yield* FromIntersect8(schema_, references_, path, value);
    case 'Iterator':
      return yield* FromIterator3(schema_, references_, path, value);
    case 'Literal':
      return yield* FromLiteral3(schema_, references_, path, value);
    case 'Never':
      return yield* FromNever2(schema_, references_, path, value);
    case 'Not':
      return yield* FromNot2(schema_, references_, path, value);
    case 'Null':
      return yield* FromNull2(schema_, references_, path, value);
    case 'Number':
      return yield* FromNumber2(schema_, references_, path, value);
    case 'Object':
      return yield* FromObject3(schema_, references_, path, value);
    case 'Promise':
      return yield* FromPromise4(schema_, references_, path, value);
    case 'Record':
      return yield* FromRecord2(schema_, references_, path, value);
    case 'Ref':
      return yield* FromRef2(schema_, references_, path, value);
    case 'RegExp':
      return yield* FromRegExp2(schema_, references_, path, value);
    case 'String':
      return yield* FromString2(schema_, references_, path, value);
    case 'Symbol':
      return yield* FromSymbol2(schema_, references_, path, value);
    case 'TemplateLiteral':
      return yield* FromTemplateLiteral4(schema_, references_, path, value);
    case 'This':
      return yield* FromThis(schema_, references_, path, value);
    case 'Tuple':
      return yield* FromTuple5(schema_, references_, path, value);
    case 'Undefined':
      return yield* FromUndefined2(schema_, references_, path, value);
    case 'Union':
      return yield* FromUnion10(schema_, references_, path, value);
    case 'Uint8Array':
      return yield* FromUint8Array2(schema_, references_, path, value);
    case 'Unknown':
      return yield* FromUnknown2(schema_, references_, path, value);
    case 'Void':
      return yield* FromVoid2(schema_, references_, path, value);
    default:
      if (!type_exports2.Has(schema_[Kind]))
        throw new ValueErrorsUnknownTypeError(schema);
      return yield* FromKind(schema_, references_, path, value);
  }
}
__name(Visit5, 'Visit');
function Errors(...args) {
  const iterator =
    args.length === 3
      ? Visit5(args[0], args[1], '', args[2])
      : Visit5(args[0], [], '', args[1]);
  return new ValueErrorIterator(iterator);
}
__name(Errors, 'Errors');

// node_modules/@sinclair/typebox/build/esm/value/cast/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/cast/cast.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/create/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/create/create.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/check/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/check/check.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ValueCheckUnknownTypeError = class extends TypeBoxError {
  static {
    __name(this, 'ValueCheckUnknownTypeError');
  }
  constructor(schema) {
    super(`Unknown type`);
    this.schema = schema;
  }
};
function IsAnyOrUnknown(schema) {
  return schema[Kind] === 'Any' || schema[Kind] === 'Unknown';
}
__name(IsAnyOrUnknown, 'IsAnyOrUnknown');
function IsDefined2(value) {
  return value !== void 0;
}
__name(IsDefined2, 'IsDefined');
function FromAny3(schema, references, value) {
  return true;
}
__name(FromAny3, 'FromAny');
function FromArray7(schema, references, value) {
  if (!IsArray4(value)) return false;
  if (IsDefined2(schema.minItems) && !(value.length >= schema.minItems)) {
    return false;
  }
  if (IsDefined2(schema.maxItems) && !(value.length <= schema.maxItems)) {
    return false;
  }
  if (!value.every((value2) => Visit6(schema.items, references, value2))) {
    return false;
  }
  if (
    schema.uniqueItems === true &&
    !(function () {
      const set = /* @__PURE__ */ new Set();
      for (const element of value) {
        const hashed = Hash(element);
        if (set.has(hashed)) {
          return false;
        } else {
          set.add(hashed);
        }
      }
      return true;
    })()
  ) {
    return false;
  }
  if (
    !(
      IsDefined2(schema.contains) ||
      IsNumber4(schema.minContains) ||
      IsNumber4(schema.maxContains)
    )
  ) {
    return true;
  }
  const containsSchema = IsDefined2(schema.contains)
    ? schema.contains
    : Never();
  const containsCount = value.reduce(
    (acc, value2) =>
      Visit6(containsSchema, references, value2) ? acc + 1 : acc,
    0
  );
  if (containsCount === 0) {
    return false;
  }
  if (IsNumber4(schema.minContains) && containsCount < schema.minContains) {
    return false;
  }
  if (IsNumber4(schema.maxContains) && containsCount > schema.maxContains) {
    return false;
  }
  return true;
}
__name(FromArray7, 'FromArray');
function FromAsyncIterator4(schema, references, value) {
  return IsAsyncIterator4(value);
}
__name(FromAsyncIterator4, 'FromAsyncIterator');
function FromBigInt3(schema, references, value) {
  if (!IsBigInt4(value)) return false;
  if (
    IsDefined2(schema.exclusiveMaximum) &&
    !(value < schema.exclusiveMaximum)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.exclusiveMinimum) &&
    !(value > schema.exclusiveMinimum)
  ) {
    return false;
  }
  if (IsDefined2(schema.maximum) && !(value <= schema.maximum)) {
    return false;
  }
  if (IsDefined2(schema.minimum) && !(value >= schema.minimum)) {
    return false;
  }
  if (
    IsDefined2(schema.multipleOf) &&
    !(value % schema.multipleOf === BigInt(0))
  ) {
    return false;
  }
  return true;
}
__name(FromBigInt3, 'FromBigInt');
function FromBoolean3(schema, references, value) {
  return IsBoolean4(value);
}
__name(FromBoolean3, 'FromBoolean');
function FromConstructor4(schema, references, value) {
  return Visit6(schema.returns, references, value.prototype);
}
__name(FromConstructor4, 'FromConstructor');
function FromDate3(schema, references, value) {
  if (!IsDate4(value)) return false;
  if (
    IsDefined2(schema.exclusiveMaximumTimestamp) &&
    !(value.getTime() < schema.exclusiveMaximumTimestamp)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.exclusiveMinimumTimestamp) &&
    !(value.getTime() > schema.exclusiveMinimumTimestamp)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.maximumTimestamp) &&
    !(value.getTime() <= schema.maximumTimestamp)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.minimumTimestamp) &&
    !(value.getTime() >= schema.minimumTimestamp)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.multipleOfTimestamp) &&
    !(value.getTime() % schema.multipleOfTimestamp === 0)
  ) {
    return false;
  }
  return true;
}
__name(FromDate3, 'FromDate');
function FromFunction4(schema, references, value) {
  return IsFunction4(value);
}
__name(FromFunction4, 'FromFunction');
function FromInteger3(schema, references, value) {
  if (!IsInteger3(value)) {
    return false;
  }
  if (
    IsDefined2(schema.exclusiveMaximum) &&
    !(value < schema.exclusiveMaximum)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.exclusiveMinimum) &&
    !(value > schema.exclusiveMinimum)
  ) {
    return false;
  }
  if (IsDefined2(schema.maximum) && !(value <= schema.maximum)) {
    return false;
  }
  if (IsDefined2(schema.minimum) && !(value >= schema.minimum)) {
    return false;
  }
  if (IsDefined2(schema.multipleOf) && !(value % schema.multipleOf === 0)) {
    return false;
  }
  return true;
}
__name(FromInteger3, 'FromInteger');
function FromIntersect9(schema, references, value) {
  const check1 = schema.allOf.every((schema2) =>
    Visit6(schema2, references, value)
  );
  if (schema.unevaluatedProperties === false) {
    const keyPattern = new RegExp(KeyOfPattern(schema));
    const check2 = Object.getOwnPropertyNames(value).every((key) =>
      keyPattern.test(key)
    );
    return check1 && check2;
  } else if (IsSchema2(schema.unevaluatedProperties)) {
    const keyCheck = new RegExp(KeyOfPattern(schema));
    const check2 = Object.getOwnPropertyNames(value).every(
      (key) =>
        keyCheck.test(key) ||
        Visit6(schema.unevaluatedProperties, references, value[key])
    );
    return check1 && check2;
  } else {
    return check1;
  }
}
__name(FromIntersect9, 'FromIntersect');
function FromIterator4(schema, references, value) {
  return IsIterator4(value);
}
__name(FromIterator4, 'FromIterator');
function FromLiteral4(schema, references, value) {
  return value === schema.const;
}
__name(FromLiteral4, 'FromLiteral');
function FromNever3(schema, references, value) {
  return false;
}
__name(FromNever3, 'FromNever');
function FromNot3(schema, references, value) {
  return !Visit6(schema.not, references, value);
}
__name(FromNot3, 'FromNot');
function FromNull3(schema, references, value) {
  return IsNull4(value);
}
__name(FromNull3, 'FromNull');
function FromNumber3(schema, references, value) {
  if (!TypeSystemPolicy.IsNumberLike(value)) return false;
  if (
    IsDefined2(schema.exclusiveMaximum) &&
    !(value < schema.exclusiveMaximum)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.exclusiveMinimum) &&
    !(value > schema.exclusiveMinimum)
  ) {
    return false;
  }
  if (IsDefined2(schema.minimum) && !(value >= schema.minimum)) {
    return false;
  }
  if (IsDefined2(schema.maximum) && !(value <= schema.maximum)) {
    return false;
  }
  if (IsDefined2(schema.multipleOf) && !(value % schema.multipleOf === 0)) {
    return false;
  }
  return true;
}
__name(FromNumber3, 'FromNumber');
function FromObject4(schema, references, value) {
  if (!TypeSystemPolicy.IsObjectLike(value)) return false;
  if (
    IsDefined2(schema.minProperties) &&
    !(Object.getOwnPropertyNames(value).length >= schema.minProperties)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.maxProperties) &&
    !(Object.getOwnPropertyNames(value).length <= schema.maxProperties)
  ) {
    return false;
  }
  const knownKeys = Object.getOwnPropertyNames(schema.properties);
  for (const knownKey of knownKeys) {
    const property = schema.properties[knownKey];
    if (schema.required && schema.required.includes(knownKey)) {
      if (!Visit6(property, references, value[knownKey])) {
        return false;
      }
      if (
        (ExtendsUndefinedCheck(property) || IsAnyOrUnknown(property)) &&
        !(knownKey in value)
      ) {
        return false;
      }
    } else {
      if (
        TypeSystemPolicy.IsExactOptionalProperty(value, knownKey) &&
        !Visit6(property, references, value[knownKey])
      ) {
        return false;
      }
    }
  }
  if (schema.additionalProperties === false) {
    const valueKeys = Object.getOwnPropertyNames(value);
    if (
      schema.required &&
      schema.required.length === knownKeys.length &&
      valueKeys.length === knownKeys.length
    ) {
      return true;
    } else {
      return valueKeys.every((valueKey) => knownKeys.includes(valueKey));
    }
  } else if (typeof schema.additionalProperties === 'object') {
    const valueKeys = Object.getOwnPropertyNames(value);
    return valueKeys.every(
      (key) =>
        knownKeys.includes(key) ||
        Visit6(schema.additionalProperties, references, value[key])
    );
  } else {
    return true;
  }
}
__name(FromObject4, 'FromObject');
function FromPromise5(schema, references, value) {
  return IsPromise3(value);
}
__name(FromPromise5, 'FromPromise');
function FromRecord3(schema, references, value) {
  if (!TypeSystemPolicy.IsRecordLike(value)) {
    return false;
  }
  if (
    IsDefined2(schema.minProperties) &&
    !(Object.getOwnPropertyNames(value).length >= schema.minProperties)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.maxProperties) &&
    !(Object.getOwnPropertyNames(value).length <= schema.maxProperties)
  ) {
    return false;
  }
  const [patternKey, patternSchema] = Object.entries(
    schema.patternProperties
  )[0];
  const regex = new RegExp(patternKey);
  const check1 = Object.entries(value).every(([key, value2]) => {
    return regex.test(key) ? Visit6(patternSchema, references, value2) : true;
  });
  const check2 =
    typeof schema.additionalProperties === 'object'
      ? Object.entries(value).every(([key, value2]) => {
          return !regex.test(key)
            ? Visit6(schema.additionalProperties, references, value2)
            : true;
        })
      : true;
  const check3 =
    schema.additionalProperties === false
      ? Object.getOwnPropertyNames(value).every((key) => {
          return regex.test(key);
        })
      : true;
  return check1 && check2 && check3;
}
__name(FromRecord3, 'FromRecord');
function FromRef3(schema, references, value) {
  return Visit6(Deref2(schema, references), references, value);
}
__name(FromRef3, 'FromRef');
function FromRegExp3(schema, references, value) {
  const regex = new RegExp(schema.source, schema.flags);
  if (IsDefined2(schema.minLength)) {
    if (!(value.length >= schema.minLength)) return false;
  }
  if (IsDefined2(schema.maxLength)) {
    if (!(value.length <= schema.maxLength)) return false;
  }
  return regex.test(value);
}
__name(FromRegExp3, 'FromRegExp');
function FromString3(schema, references, value) {
  if (!IsString4(value)) {
    return false;
  }
  if (IsDefined2(schema.minLength)) {
    if (!(value.length >= schema.minLength)) return false;
  }
  if (IsDefined2(schema.maxLength)) {
    if (!(value.length <= schema.maxLength)) return false;
  }
  if (IsDefined2(schema.pattern)) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) return false;
  }
  if (IsDefined2(schema.format)) {
    if (!format_exports.Has(schema.format)) return false;
    const func = format_exports.Get(schema.format);
    return func(value);
  }
  return true;
}
__name(FromString3, 'FromString');
function FromSymbol3(schema, references, value) {
  return IsSymbol4(value);
}
__name(FromSymbol3, 'FromSymbol');
function FromTemplateLiteral5(schema, references, value) {
  return IsString4(value) && new RegExp(schema.pattern).test(value);
}
__name(FromTemplateLiteral5, 'FromTemplateLiteral');
function FromThis2(schema, references, value) {
  return Visit6(Deref2(schema, references), references, value);
}
__name(FromThis2, 'FromThis');
function FromTuple6(schema, references, value) {
  if (!IsArray4(value)) {
    return false;
  }
  if (schema.items === void 0 && !(value.length === 0)) {
    return false;
  }
  if (!(value.length === schema.maxItems)) {
    return false;
  }
  if (!schema.items) {
    return true;
  }
  for (let i = 0; i < schema.items.length; i++) {
    if (!Visit6(schema.items[i], references, value[i])) return false;
  }
  return true;
}
__name(FromTuple6, 'FromTuple');
function FromUndefined3(schema, references, value) {
  return IsUndefined4(value);
}
__name(FromUndefined3, 'FromUndefined');
function FromUnion11(schema, references, value) {
  return schema.anyOf.some((inner) => Visit6(inner, references, value));
}
__name(FromUnion11, 'FromUnion');
function FromUint8Array3(schema, references, value) {
  if (!IsUint8Array4(value)) {
    return false;
  }
  if (
    IsDefined2(schema.maxByteLength) &&
    !(value.length <= schema.maxByteLength)
  ) {
    return false;
  }
  if (
    IsDefined2(schema.minByteLength) &&
    !(value.length >= schema.minByteLength)
  ) {
    return false;
  }
  return true;
}
__name(FromUint8Array3, 'FromUint8Array');
function FromUnknown3(schema, references, value) {
  return true;
}
__name(FromUnknown3, 'FromUnknown');
function FromVoid3(schema, references, value) {
  return TypeSystemPolicy.IsVoidLike(value);
}
__name(FromVoid3, 'FromVoid');
function FromKind2(schema, references, value) {
  if (!type_exports2.Has(schema[Kind])) return false;
  const func = type_exports2.Get(schema[Kind]);
  return func(schema, value);
}
__name(FromKind2, 'FromKind');
function Visit6(schema, references, value) {
  const references_ = IsDefined2(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema_[Kind]) {
    case 'Any':
      return FromAny3(schema_, references_, value);
    case 'Array':
      return FromArray7(schema_, references_, value);
    case 'AsyncIterator':
      return FromAsyncIterator4(schema_, references_, value);
    case 'BigInt':
      return FromBigInt3(schema_, references_, value);
    case 'Boolean':
      return FromBoolean3(schema_, references_, value);
    case 'Constructor':
      return FromConstructor4(schema_, references_, value);
    case 'Date':
      return FromDate3(schema_, references_, value);
    case 'Function':
      return FromFunction4(schema_, references_, value);
    case 'Integer':
      return FromInteger3(schema_, references_, value);
    case 'Intersect':
      return FromIntersect9(schema_, references_, value);
    case 'Iterator':
      return FromIterator4(schema_, references_, value);
    case 'Literal':
      return FromLiteral4(schema_, references_, value);
    case 'Never':
      return FromNever3(schema_, references_, value);
    case 'Not':
      return FromNot3(schema_, references_, value);
    case 'Null':
      return FromNull3(schema_, references_, value);
    case 'Number':
      return FromNumber3(schema_, references_, value);
    case 'Object':
      return FromObject4(schema_, references_, value);
    case 'Promise':
      return FromPromise5(schema_, references_, value);
    case 'Record':
      return FromRecord3(schema_, references_, value);
    case 'Ref':
      return FromRef3(schema_, references_, value);
    case 'RegExp':
      return FromRegExp3(schema_, references_, value);
    case 'String':
      return FromString3(schema_, references_, value);
    case 'Symbol':
      return FromSymbol3(schema_, references_, value);
    case 'TemplateLiteral':
      return FromTemplateLiteral5(schema_, references_, value);
    case 'This':
      return FromThis2(schema_, references_, value);
    case 'Tuple':
      return FromTuple6(schema_, references_, value);
    case 'Undefined':
      return FromUndefined3(schema_, references_, value);
    case 'Union':
      return FromUnion11(schema_, references_, value);
    case 'Uint8Array':
      return FromUint8Array3(schema_, references_, value);
    case 'Unknown':
      return FromUnknown3(schema_, references_, value);
    case 'Void':
      return FromVoid3(schema_, references_, value);
    default:
      if (!type_exports2.Has(schema_[Kind]))
        throw new ValueCheckUnknownTypeError(schema_);
      return FromKind2(schema_, references_, value);
  }
}
__name(Visit6, 'Visit');
function Check(...args) {
  return args.length === 3
    ? Visit6(args[0], args[1], args[2])
    : Visit6(args[0], [], args[1]);
}
__name(Check, 'Check');

// node_modules/@sinclair/typebox/build/esm/value/clone/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/clone/clone.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ObjectType3(value) {
  const Acc = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    Acc[key] = Clone2(value[key]);
  }
  for (const key of Object.getOwnPropertySymbols(value)) {
    Acc[key] = Clone2(value[key]);
  }
  return Acc;
}
__name(ObjectType3, 'ObjectType');
function ArrayType3(value) {
  return value.map((element) => Clone2(element));
}
__name(ArrayType3, 'ArrayType');
function TypedArrayType(value) {
  return value.slice();
}
__name(TypedArrayType, 'TypedArrayType');
function DateType3(value) {
  return new Date(value.toISOString());
}
__name(DateType3, 'DateType');
function ValueType(value) {
  return value;
}
__name(ValueType, 'ValueType');
function Clone2(value) {
  if (IsArray4(value)) return ArrayType3(value);
  if (IsDate4(value)) return DateType3(value);
  if (IsStandardObject(value)) return ObjectType3(value);
  if (IsTypedArray(value)) return TypedArrayType(value);
  if (IsValueType(value)) return ValueType(value);
  throw new Error('ValueClone: Unable to clone value');
}
__name(Clone2, 'Clone');

// node_modules/@sinclair/typebox/build/esm/value/create/create.mjs
var ValueCreateError = class extends TypeBoxError {
  static {
    __name(this, 'ValueCreateError');
  }
  constructor(schema, message) {
    super(message);
    this.schema = schema;
  }
};
function FromDefault(value) {
  return typeof value === 'function' ? value : Clone2(value);
}
__name(FromDefault, 'FromDefault');
function FromAny4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return {};
  }
}
__name(FromAny4, 'FromAny');
function FromArray8(schema, references) {
  if (schema.uniqueItems === true && !HasPropertyKey(schema, 'default')) {
    throw new ValueCreateError(
      schema,
      'Array with the uniqueItems constraint requires a default value'
    );
  } else if ('contains' in schema && !HasPropertyKey(schema, 'default')) {
    throw new ValueCreateError(
      schema,
      'Array with the contains constraint requires a default value'
    );
  } else if ('default' in schema) {
    return FromDefault(schema.default);
  } else if (schema.minItems !== void 0) {
    return Array.from({ length: schema.minItems }).map((item) => {
      return Visit7(schema.items, references);
    });
  } else {
    return [];
  }
}
__name(FromArray8, 'FromArray');
function FromAsyncIterator5(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return (async function* () {})();
  }
}
__name(FromAsyncIterator5, 'FromAsyncIterator');
function FromBigInt4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return BigInt(0);
  }
}
__name(FromBigInt4, 'FromBigInt');
function FromBoolean4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return false;
  }
}
__name(FromBoolean4, 'FromBoolean');
function FromConstructor5(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    const value = Visit7(schema.returns, references);
    if (typeof value === 'object' && !Array.isArray(value)) {
      return class {
        constructor() {
          for (const [key, val] of Object.entries(value)) {
            const self2 = this;
            self2[key] = val;
          }
        }
      };
    } else {
      return class {};
    }
  }
}
__name(FromConstructor5, 'FromConstructor');
function FromDate4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if (schema.minimumTimestamp !== void 0) {
    return new Date(schema.minimumTimestamp);
  } else {
    return /* @__PURE__ */ new Date();
  }
}
__name(FromDate4, 'FromDate');
function FromFunction5(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return () => Visit7(schema.returns, references);
  }
}
__name(FromFunction5, 'FromFunction');
function FromInteger4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if (schema.minimum !== void 0) {
    return schema.minimum;
  } else {
    return 0;
  }
}
__name(FromInteger4, 'FromInteger');
function FromIntersect10(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    const value = schema.allOf.reduce((acc, schema2) => {
      const next = Visit7(schema2, references);
      return typeof next === 'object' ? { ...acc, ...next } : next;
    }, {});
    if (!Check(schema, references, value))
      throw new ValueCreateError(
        schema,
        'Intersect produced invalid value. Consider using a default value.'
      );
    return value;
  }
}
__name(FromIntersect10, 'FromIntersect');
function FromIterator5(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return (function* () {})();
  }
}
__name(FromIterator5, 'FromIterator');
function FromLiteral5(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return schema.const;
  }
}
__name(FromLiteral5, 'FromLiteral');
function FromNever4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    throw new ValueCreateError(
      schema,
      'Never types cannot be created. Consider using a default value.'
    );
  }
}
__name(FromNever4, 'FromNever');
function FromNot4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    throw new ValueCreateError(schema, 'Not types must have a default value');
  }
}
__name(FromNot4, 'FromNot');
function FromNull4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return null;
  }
}
__name(FromNull4, 'FromNull');
function FromNumber4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if (schema.minimum !== void 0) {
    return schema.minimum;
  } else {
    return 0;
  }
}
__name(FromNumber4, 'FromNumber');
function FromObject5(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    const required = new Set(schema.required);
    const Acc = {};
    for (const [key, subschema] of Object.entries(schema.properties)) {
      if (!required.has(key)) continue;
      Acc[key] = Visit7(subschema, references);
    }
    return Acc;
  }
}
__name(FromObject5, 'FromObject');
function FromPromise6(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return Promise.resolve(Visit7(schema.item, references));
  }
}
__name(FromPromise6, 'FromPromise');
function FromRecord4(schema, references) {
  const [keyPattern, valueSchema] = Object.entries(schema.patternProperties)[0];
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if (
    !(keyPattern === PatternStringExact || keyPattern === PatternNumberExact)
  ) {
    const propertyKeys = keyPattern.slice(1, keyPattern.length - 1).split('|');
    const Acc = {};
    for (const key of propertyKeys) Acc[key] = Visit7(valueSchema, references);
    return Acc;
  } else {
    return {};
  }
}
__name(FromRecord4, 'FromRecord');
function FromRef4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return Visit7(Deref2(schema, references), references);
  }
}
__name(FromRef4, 'FromRef');
function FromRegExp4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    throw new ValueCreateError(
      schema,
      'RegExp types cannot be created. Consider using a default value.'
    );
  }
}
__name(FromRegExp4, 'FromRegExp');
function FromString4(schema, references) {
  if (schema.pattern !== void 0) {
    if (!HasPropertyKey(schema, 'default')) {
      throw new ValueCreateError(
        schema,
        'String types with patterns must specify a default value'
      );
    } else {
      return FromDefault(schema.default);
    }
  } else if (schema.format !== void 0) {
    if (!HasPropertyKey(schema, 'default')) {
      throw new ValueCreateError(
        schema,
        'String types with formats must specify a default value'
      );
    } else {
      return FromDefault(schema.default);
    }
  } else {
    if (HasPropertyKey(schema, 'default')) {
      return FromDefault(schema.default);
    } else if (schema.minLength !== void 0) {
      return Array.from({ length: schema.minLength })
        .map(() => ' ')
        .join('');
    } else {
      return '';
    }
  }
}
__name(FromString4, 'FromString');
function FromSymbol4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if ('value' in schema) {
    return Symbol.for(schema.value);
  } else {
    return Symbol();
  }
}
__name(FromSymbol4, 'FromSymbol');
function FromTemplateLiteral6(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  }
  if (!IsTemplateLiteralFinite(schema))
    throw new ValueCreateError(
      schema,
      'Can only create template literals that produce a finite variants. Consider using a default value.'
    );
  const generated = TemplateLiteralGenerate(schema);
  return generated[0];
}
__name(FromTemplateLiteral6, 'FromTemplateLiteral');
function FromThis3(schema, references) {
  if (recursiveDepth++ > recursiveMaxDepth)
    throw new ValueCreateError(
      schema,
      'Cannot create recursive type as it appears possibly infinite. Consider using a default.'
    );
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return Visit7(Deref2(schema, references), references);
  }
}
__name(FromThis3, 'FromThis');
function FromTuple7(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  }
  if (schema.items === void 0) {
    return [];
  } else {
    return Array.from({ length: schema.minItems }).map((_, index) =>
      Visit7(schema.items[index], references)
    );
  }
}
__name(FromTuple7, 'FromTuple');
function FromUndefined4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return void 0;
  }
}
__name(FromUndefined4, 'FromUndefined');
function FromUnion12(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if (schema.anyOf.length === 0) {
    throw new Error(
      'ValueCreate.Union: Cannot create Union with zero variants'
    );
  } else {
    return Visit7(schema.anyOf[0], references);
  }
}
__name(FromUnion12, 'FromUnion');
function FromUint8Array4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else if (schema.minByteLength !== void 0) {
    return new Uint8Array(schema.minByteLength);
  } else {
    return new Uint8Array(0);
  }
}
__name(FromUint8Array4, 'FromUint8Array');
function FromUnknown4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return {};
  }
}
__name(FromUnknown4, 'FromUnknown');
function FromVoid4(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    return void 0;
  }
}
__name(FromVoid4, 'FromVoid');
function FromKind3(schema, references) {
  if (HasPropertyKey(schema, 'default')) {
    return FromDefault(schema.default);
  } else {
    throw new Error('User defined types must specify a default value');
  }
}
__name(FromKind3, 'FromKind');
function Visit7(schema, references) {
  const references_ = IsString4(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema_[Kind]) {
    case 'Any':
      return FromAny4(schema_, references_);
    case 'Array':
      return FromArray8(schema_, references_);
    case 'AsyncIterator':
      return FromAsyncIterator5(schema_, references_);
    case 'BigInt':
      return FromBigInt4(schema_, references_);
    case 'Boolean':
      return FromBoolean4(schema_, references_);
    case 'Constructor':
      return FromConstructor5(schema_, references_);
    case 'Date':
      return FromDate4(schema_, references_);
    case 'Function':
      return FromFunction5(schema_, references_);
    case 'Integer':
      return FromInteger4(schema_, references_);
    case 'Intersect':
      return FromIntersect10(schema_, references_);
    case 'Iterator':
      return FromIterator5(schema_, references_);
    case 'Literal':
      return FromLiteral5(schema_, references_);
    case 'Never':
      return FromNever4(schema_, references_);
    case 'Not':
      return FromNot4(schema_, references_);
    case 'Null':
      return FromNull4(schema_, references_);
    case 'Number':
      return FromNumber4(schema_, references_);
    case 'Object':
      return FromObject5(schema_, references_);
    case 'Promise':
      return FromPromise6(schema_, references_);
    case 'Record':
      return FromRecord4(schema_, references_);
    case 'Ref':
      return FromRef4(schema_, references_);
    case 'RegExp':
      return FromRegExp4(schema_, references_);
    case 'String':
      return FromString4(schema_, references_);
    case 'Symbol':
      return FromSymbol4(schema_, references_);
    case 'TemplateLiteral':
      return FromTemplateLiteral6(schema_, references_);
    case 'This':
      return FromThis3(schema_, references_);
    case 'Tuple':
      return FromTuple7(schema_, references_);
    case 'Undefined':
      return FromUndefined4(schema_, references_);
    case 'Union':
      return FromUnion12(schema_, references_);
    case 'Uint8Array':
      return FromUint8Array4(schema_, references_);
    case 'Unknown':
      return FromUnknown4(schema_, references_);
    case 'Void':
      return FromVoid4(schema_, references_);
    default:
      if (!type_exports2.Has(schema_[Kind]))
        throw new ValueCreateError(schema_, 'Unknown type');
      return FromKind3(schema_, references_);
  }
}
__name(Visit7, 'Visit');
var recursiveMaxDepth = 512;
var recursiveDepth = 0;
function Create2(...args) {
  recursiveDepth = 0;
  return args.length === 2 ? Visit7(args[0], args[1]) : Visit7(args[0], []);
}
__name(Create2, 'Create');

// node_modules/@sinclair/typebox/build/esm/value/cast/cast.mjs
var ValueCastError = class extends TypeBoxError {
  static {
    __name(this, 'ValueCastError');
  }
  constructor(schema, message) {
    super(message);
    this.schema = schema;
  }
};
function ScoreUnion(schema, references, value) {
  if (
    schema[Kind] === 'Object' &&
    typeof value === 'object' &&
    !IsNull4(value)
  ) {
    const object = schema;
    const keys = Object.getOwnPropertyNames(value);
    const entries = Object.entries(object.properties);
    const [point, max] = [1 / entries.length, entries.length];
    return entries.reduce((acc, [key, schema2]) => {
      const literal =
        schema2[Kind] === 'Literal' && schema2.const === value[key] ? max : 0;
      const checks = Check(schema2, references, value[key]) ? point : 0;
      const exists = keys.includes(key) ? point : 0;
      return acc + (literal + checks + exists);
    }, 0);
  } else {
    return Check(schema, references, value) ? 1 : 0;
  }
}
__name(ScoreUnion, 'ScoreUnion');
function SelectUnion(union, references, value) {
  const schemas = union.anyOf.map((schema) => Deref2(schema, references));
  let [select, best] = [schemas[0], 0];
  for (const schema of schemas) {
    const score = ScoreUnion(schema, references, value);
    if (score > best) {
      select = schema;
      best = score;
    }
  }
  return select;
}
__name(SelectUnion, 'SelectUnion');
function CastUnion(union, references, value) {
  if ('default' in union) {
    return typeof value === 'function' ? union.default : Clone2(union.default);
  } else {
    const schema = SelectUnion(union, references, value);
    return Cast(schema, references, value);
  }
}
__name(CastUnion, 'CastUnion');
function DefaultClone(schema, references, value) {
  return Check(schema, references, value)
    ? Clone2(value)
    : Create2(schema, references);
}
__name(DefaultClone, 'DefaultClone');
function Default(schema, references, value) {
  return Check(schema, references, value) ? value : Create2(schema, references);
}
__name(Default, 'Default');
function FromArray9(schema, references, value) {
  if (Check(schema, references, value)) return Clone2(value);
  const created = IsArray4(value) ? Clone2(value) : Create2(schema, references);
  const minimum =
    IsNumber4(schema.minItems) && created.length < schema.minItems
      ? [
          ...created,
          ...Array.from(
            { length: schema.minItems - created.length },
            () => null
          ),
        ]
      : created;
  const maximum =
    IsNumber4(schema.maxItems) && minimum.length > schema.maxItems
      ? minimum.slice(0, schema.maxItems)
      : minimum;
  const casted = maximum.map((value2) =>
    Visit8(schema.items, references, value2)
  );
  if (schema.uniqueItems !== true) return casted;
  const unique = [...new Set(casted)];
  if (!Check(schema, references, unique))
    throw new ValueCastError(
      schema,
      'Array cast produced invalid data due to uniqueItems constraint'
    );
  return unique;
}
__name(FromArray9, 'FromArray');
function FromConstructor6(schema, references, value) {
  if (Check(schema, references, value)) return Create2(schema, references);
  const required = new Set(schema.returns.required || []);
  const result = /* @__PURE__ */ __name(function () {}, 'result');
  for (const [key, property] of Object.entries(schema.returns.properties)) {
    if (!required.has(key) && value.prototype[key] === void 0) continue;
    result.prototype[key] = Visit8(property, references, value.prototype[key]);
  }
  return result;
}
__name(FromConstructor6, 'FromConstructor');
function FromIntersect11(schema, references, value) {
  const created = Create2(schema, references);
  const mapped =
    IsStandardObject(created) && IsStandardObject(value)
      ? { ...created, ...value }
      : value;
  return Check(schema, references, mapped)
    ? mapped
    : Create2(schema, references);
}
__name(FromIntersect11, 'FromIntersect');
function FromNever5(schema, references, value) {
  throw new ValueCastError(schema, 'Never types cannot be cast');
}
__name(FromNever5, 'FromNever');
function FromObject6(schema, references, value) {
  if (Check(schema, references, value)) return value;
  if (value === null || typeof value !== 'object')
    return Create2(schema, references);
  const required = new Set(schema.required || []);
  const result = {};
  for (const [key, property] of Object.entries(schema.properties)) {
    if (!required.has(key) && value[key] === void 0) continue;
    result[key] = Visit8(property, references, value[key]);
  }
  if (typeof schema.additionalProperties === 'object') {
    const propertyNames = Object.getOwnPropertyNames(schema.properties);
    for (const propertyName of Object.getOwnPropertyNames(value)) {
      if (propertyNames.includes(propertyName)) continue;
      result[propertyName] = Visit8(
        schema.additionalProperties,
        references,
        value[propertyName]
      );
    }
  }
  return result;
}
__name(FromObject6, 'FromObject');
function FromRecord5(schema, references, value) {
  if (Check(schema, references, value)) return Clone2(value);
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof Date
  )
    return Create2(schema, references);
  const subschemaPropertyName = Object.getOwnPropertyNames(
    schema.patternProperties
  )[0];
  const subschema = schema.patternProperties[subschemaPropertyName];
  const result = {};
  for (const [propKey, propValue] of Object.entries(value)) {
    result[propKey] = Visit8(subschema, references, propValue);
  }
  return result;
}
__name(FromRecord5, 'FromRecord');
function FromRef5(schema, references, value) {
  return Visit8(Deref2(schema, references), references, value);
}
__name(FromRef5, 'FromRef');
function FromThis4(schema, references, value) {
  return Visit8(Deref2(schema, references), references, value);
}
__name(FromThis4, 'FromThis');
function FromTuple8(schema, references, value) {
  if (Check(schema, references, value)) return Clone2(value);
  if (!IsArray4(value)) return Create2(schema, references);
  if (schema.items === void 0) return [];
  return schema.items.map((schema2, index) =>
    Visit8(schema2, references, value[index])
  );
}
__name(FromTuple8, 'FromTuple');
function FromUnion13(schema, references, value) {
  return Check(schema, references, value)
    ? Clone2(value)
    : CastUnion(schema, references, value);
}
__name(FromUnion13, 'FromUnion');
function Visit8(schema, references, value) {
  const references_ = IsString4(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema[Kind]) {
    // --------------------------------------------------------------
    // Structural
    // --------------------------------------------------------------
    case 'Array':
      return FromArray9(schema_, references_, value);
    case 'Constructor':
      return FromConstructor6(schema_, references_, value);
    case 'Intersect':
      return FromIntersect11(schema_, references_, value);
    case 'Never':
      return FromNever5(schema_, references_, value);
    case 'Object':
      return FromObject6(schema_, references_, value);
    case 'Record':
      return FromRecord5(schema_, references_, value);
    case 'Ref':
      return FromRef5(schema_, references_, value);
    case 'This':
      return FromThis4(schema_, references_, value);
    case 'Tuple':
      return FromTuple8(schema_, references_, value);
    case 'Union':
      return FromUnion13(schema_, references_, value);
    // --------------------------------------------------------------
    // DefaultClone
    // --------------------------------------------------------------
    case 'Date':
    case 'Symbol':
    case 'Uint8Array':
      return DefaultClone(schema, references, value);
    // --------------------------------------------------------------
    // Default
    // --------------------------------------------------------------
    default:
      return Default(schema_, references_, value);
  }
}
__name(Visit8, 'Visit');
function Cast(...args) {
  return args.length === 3
    ? Visit8(args[0], args[1], args[2])
    : Visit8(args[0], [], args[1]);
}
__name(Cast, 'Cast');

// node_modules/@sinclair/typebox/build/esm/value/clean/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/clean/clean.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function IsCheckable(schema) {
  return IsSchema2(schema) && schema[Kind] !== 'Unsafe';
}
__name(IsCheckable, 'IsCheckable');
function FromArray10(schema, references, value) {
  if (!IsArray4(value)) return value;
  return value.map((value2) => Visit9(schema.items, references, value2));
}
__name(FromArray10, 'FromArray');
function FromIntersect12(schema, references, value) {
  const unevaluatedProperties = schema.unevaluatedProperties;
  const intersections = schema.allOf.map((schema2) =>
    Visit9(schema2, references, Clone2(value))
  );
  const composite = intersections.reduce(
    (acc, value2) => (IsObject4(value2) ? { ...acc, ...value2 } : value2),
    {}
  );
  if (
    !IsObject4(value) ||
    !IsObject4(composite) ||
    !IsSchema2(unevaluatedProperties)
  )
    return composite;
  const knownkeys = KeyOfPropertyKeys(schema);
  for (const key of Object.getOwnPropertyNames(value)) {
    if (knownkeys.includes(key)) continue;
    if (Check(unevaluatedProperties, references, value[key])) {
      composite[key] = Visit9(unevaluatedProperties, references, value[key]);
    }
  }
  return composite;
}
__name(FromIntersect12, 'FromIntersect');
function FromObject7(schema, references, value) {
  if (!IsObject4(value) || IsArray4(value)) return value;
  const additionalProperties = schema.additionalProperties;
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key in schema.properties) {
      value[key] = Visit9(schema.properties[key], references, value[key]);
      continue;
    }
    if (
      IsSchema2(additionalProperties) &&
      Check(additionalProperties, references, value[key])
    ) {
      value[key] = Visit9(additionalProperties, references, value[key]);
      continue;
    }
    delete value[key];
  }
  return value;
}
__name(FromObject7, 'FromObject');
function FromRecord6(schema, references, value) {
  if (!IsObject4(value)) return value;
  const additionalProperties = schema.additionalProperties;
  const propertyKeys = Object.getOwnPropertyNames(value);
  const [propertyKey, propertySchema] = Object.entries(
    schema.patternProperties
  )[0];
  const propertyKeyTest = new RegExp(propertyKey);
  for (const key of propertyKeys) {
    if (propertyKeyTest.test(key)) {
      value[key] = Visit9(propertySchema, references, value[key]);
      continue;
    }
    if (
      IsSchema2(additionalProperties) &&
      Check(additionalProperties, references, value[key])
    ) {
      value[key] = Visit9(additionalProperties, references, value[key]);
      continue;
    }
    delete value[key];
  }
  return value;
}
__name(FromRecord6, 'FromRecord');
function FromRef6(schema, references, value) {
  return Visit9(Deref2(schema, references), references, value);
}
__name(FromRef6, 'FromRef');
function FromThis5(schema, references, value) {
  return Visit9(Deref2(schema, references), references, value);
}
__name(FromThis5, 'FromThis');
function FromTuple9(schema, references, value) {
  if (!IsArray4(value)) return value;
  if (IsUndefined4(schema.items)) return [];
  const length = Math.min(value.length, schema.items.length);
  for (let i = 0; i < length; i++) {
    value[i] = Visit9(schema.items[i], references, value[i]);
  }
  return value.length > length ? value.slice(0, length) : value;
}
__name(FromTuple9, 'FromTuple');
function FromUnion14(schema, references, value) {
  for (const inner of schema.anyOf) {
    if (IsCheckable(inner) && Check(inner, references, value)) {
      return Visit9(inner, references, value);
    }
  }
  return value;
}
__name(FromUnion14, 'FromUnion');
function Visit9(schema, references, value) {
  const references_ = IsString4(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema_[Kind]) {
    case 'Array':
      return FromArray10(schema_, references_, value);
    case 'Intersect':
      return FromIntersect12(schema_, references_, value);
    case 'Object':
      return FromObject7(schema_, references_, value);
    case 'Record':
      return FromRecord6(schema_, references_, value);
    case 'Ref':
      return FromRef6(schema_, references_, value);
    case 'This':
      return FromThis5(schema_, references_, value);
    case 'Tuple':
      return FromTuple9(schema_, references_, value);
    case 'Union':
      return FromUnion14(schema_, references_, value);
    default:
      return value;
  }
}
__name(Visit9, 'Visit');
function Clean(...args) {
  return args.length === 3
    ? Visit9(args[0], args[1], args[2])
    : Visit9(args[0], [], args[1]);
}
__name(Clean, 'Clean');

// node_modules/@sinclair/typebox/build/esm/value/convert/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/convert/convert.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function IsStringNumeric(value) {
  return IsString4(value) && !isNaN(value) && !isNaN(parseFloat(value));
}
__name(IsStringNumeric, 'IsStringNumeric');
function IsValueToString(value) {
  return IsBigInt4(value) || IsBoolean4(value) || IsNumber4(value);
}
__name(IsValueToString, 'IsValueToString');
function IsValueTrue(value) {
  return (
    value === true ||
    (IsNumber4(value) && value === 1) ||
    (IsBigInt4(value) && value === BigInt('1')) ||
    (IsString4(value) && (value.toLowerCase() === 'true' || value === '1'))
  );
}
__name(IsValueTrue, 'IsValueTrue');
function IsValueFalse(value) {
  return (
    value === false ||
    (IsNumber4(value) && (value === 0 || Object.is(value, -0))) ||
    (IsBigInt4(value) && value === BigInt('0')) ||
    (IsString4(value) &&
      (value.toLowerCase() === 'false' || value === '0' || value === '-0'))
  );
}
__name(IsValueFalse, 'IsValueFalse');
function IsTimeStringWithTimeZone(value) {
  return (
    IsString4(value) &&
    /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i.test(
      value
    )
  );
}
__name(IsTimeStringWithTimeZone, 'IsTimeStringWithTimeZone');
function IsTimeStringWithoutTimeZone(value) {
  return (
    IsString4(value) && /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)?$/i.test(value)
  );
}
__name(IsTimeStringWithoutTimeZone, 'IsTimeStringWithoutTimeZone');
function IsDateTimeStringWithTimeZone(value) {
  return (
    IsString4(value) &&
    /^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i.test(
      value
    )
  );
}
__name(IsDateTimeStringWithTimeZone, 'IsDateTimeStringWithTimeZone');
function IsDateTimeStringWithoutTimeZone(value) {
  return (
    IsString4(value) &&
    /^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)?$/i.test(
      value
    )
  );
}
__name(IsDateTimeStringWithoutTimeZone, 'IsDateTimeStringWithoutTimeZone');
function IsDateString(value) {
  return IsString4(value) && /^\d\d\d\d-[0-1]\d-[0-3]\d$/i.test(value);
}
__name(IsDateString, 'IsDateString');
function TryConvertLiteralString(value, target) {
  const conversion = TryConvertString(value);
  return conversion === target ? conversion : value;
}
__name(TryConvertLiteralString, 'TryConvertLiteralString');
function TryConvertLiteralNumber(value, target) {
  const conversion = TryConvertNumber(value);
  return conversion === target ? conversion : value;
}
__name(TryConvertLiteralNumber, 'TryConvertLiteralNumber');
function TryConvertLiteralBoolean(value, target) {
  const conversion = TryConvertBoolean(value);
  return conversion === target ? conversion : value;
}
__name(TryConvertLiteralBoolean, 'TryConvertLiteralBoolean');
function TryConvertLiteral(schema, value) {
  return IsString4(schema.const)
    ? TryConvertLiteralString(value, schema.const)
    : IsNumber4(schema.const)
      ? TryConvertLiteralNumber(value, schema.const)
      : IsBoolean4(schema.const)
        ? TryConvertLiteralBoolean(value, schema.const)
        : Clone2(value);
}
__name(TryConvertLiteral, 'TryConvertLiteral');
function TryConvertBoolean(value) {
  return IsValueTrue(value) ? true : IsValueFalse(value) ? false : value;
}
__name(TryConvertBoolean, 'TryConvertBoolean');
function TryConvertBigInt(value) {
  return IsStringNumeric(value)
    ? BigInt(parseInt(value))
    : IsNumber4(value)
      ? BigInt(value | 0)
      : IsValueFalse(value)
        ? BigInt(0)
        : IsValueTrue(value)
          ? BigInt(1)
          : value;
}
__name(TryConvertBigInt, 'TryConvertBigInt');
function TryConvertString(value) {
  return IsValueToString(value)
    ? value.toString()
    : IsSymbol4(value) && value.description !== void 0
      ? value.description.toString()
      : value;
}
__name(TryConvertString, 'TryConvertString');
function TryConvertNumber(value) {
  return IsStringNumeric(value)
    ? parseFloat(value)
    : IsValueTrue(value)
      ? 1
      : IsValueFalse(value)
        ? 0
        : value;
}
__name(TryConvertNumber, 'TryConvertNumber');
function TryConvertInteger(value) {
  return IsStringNumeric(value)
    ? parseInt(value)
    : IsNumber4(value)
      ? value | 0
      : IsValueTrue(value)
        ? 1
        : IsValueFalse(value)
          ? 0
          : value;
}
__name(TryConvertInteger, 'TryConvertInteger');
function TryConvertNull(value) {
  return IsString4(value) && value.toLowerCase() === 'null' ? null : value;
}
__name(TryConvertNull, 'TryConvertNull');
function TryConvertUndefined(value) {
  return IsString4(value) && value === 'undefined' ? void 0 : value;
}
__name(TryConvertUndefined, 'TryConvertUndefined');
function TryConvertDate(value) {
  return IsDate4(value)
    ? value
    : IsNumber4(value)
      ? new Date(value)
      : IsValueTrue(value)
        ? /* @__PURE__ */ new Date(1)
        : IsValueFalse(value)
          ? /* @__PURE__ */ new Date(0)
          : IsStringNumeric(value)
            ? new Date(parseInt(value))
            : IsTimeStringWithoutTimeZone(value)
              ? /* @__PURE__ */ new Date(`1970-01-01T${value}.000Z`)
              : IsTimeStringWithTimeZone(value)
                ? /* @__PURE__ */ new Date(`1970-01-01T${value}`)
                : IsDateTimeStringWithoutTimeZone(value)
                  ? /* @__PURE__ */ new Date(`${value}.000Z`)
                  : IsDateTimeStringWithTimeZone(value)
                    ? new Date(value)
                    : IsDateString(value)
                      ? /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`)
                      : value;
}
__name(TryConvertDate, 'TryConvertDate');
function Default2(value) {
  return value;
}
__name(Default2, 'Default');
function FromArray11(schema, references, value) {
  const elements = IsArray4(value) ? value : [value];
  return elements.map((element) => Visit10(schema.items, references, element));
}
__name(FromArray11, 'FromArray');
function FromBigInt5(schema, references, value) {
  return TryConvertBigInt(value);
}
__name(FromBigInt5, 'FromBigInt');
function FromBoolean5(schema, references, value) {
  return TryConvertBoolean(value);
}
__name(FromBoolean5, 'FromBoolean');
function FromDate5(schema, references, value) {
  return TryConvertDate(value);
}
__name(FromDate5, 'FromDate');
function FromInteger5(schema, references, value) {
  return TryConvertInteger(value);
}
__name(FromInteger5, 'FromInteger');
function FromIntersect13(schema, references, value) {
  return schema.allOf.reduce(
    (value2, schema2) => Visit10(schema2, references, value2),
    value
  );
}
__name(FromIntersect13, 'FromIntersect');
function FromLiteral6(schema, references, value) {
  return TryConvertLiteral(schema, value);
}
__name(FromLiteral6, 'FromLiteral');
function FromNull5(schema, references, value) {
  return TryConvertNull(value);
}
__name(FromNull5, 'FromNull');
function FromNumber5(schema, references, value) {
  return TryConvertNumber(value);
}
__name(FromNumber5, 'FromNumber');
function FromObject8(schema, references, value) {
  const isConvertable = IsObject4(value);
  if (!isConvertable) return value;
  const result = {};
  for (const key of Object.keys(value)) {
    result[key] = HasPropertyKey(schema.properties, key)
      ? Visit10(schema.properties[key], references, value[key])
      : value[key];
  }
  return result;
}
__name(FromObject8, 'FromObject');
function FromRecord7(schema, references, value) {
  const isConvertable = IsObject4(value);
  if (!isConvertable) return value;
  const propertyKey = Object.getOwnPropertyNames(schema.patternProperties)[0];
  const property = schema.patternProperties[propertyKey];
  const result = {};
  for (const [propKey, propValue] of Object.entries(value)) {
    result[propKey] = Visit10(property, references, propValue);
  }
  return result;
}
__name(FromRecord7, 'FromRecord');
function FromRef7(schema, references, value) {
  return Visit10(Deref2(schema, references), references, value);
}
__name(FromRef7, 'FromRef');
function FromString5(schema, references, value) {
  return TryConvertString(value);
}
__name(FromString5, 'FromString');
function FromSymbol5(schema, references, value) {
  return IsString4(value) || IsNumber4(value) ? Symbol(value) : value;
}
__name(FromSymbol5, 'FromSymbol');
function FromThis6(schema, references, value) {
  return Visit10(Deref2(schema, references), references, value);
}
__name(FromThis6, 'FromThis');
function FromTuple10(schema, references, value) {
  const isConvertable = IsArray4(value) && !IsUndefined4(schema.items);
  if (!isConvertable) return value;
  return value.map((value2, index) => {
    return index < schema.items.length
      ? Visit10(schema.items[index], references, value2)
      : value2;
  });
}
__name(FromTuple10, 'FromTuple');
function FromUndefined5(schema, references, value) {
  return TryConvertUndefined(value);
}
__name(FromUndefined5, 'FromUndefined');
function FromUnion15(schema, references, value) {
  for (const subschema of schema.anyOf) {
    const converted = Visit10(subschema, references, value);
    if (!Check(subschema, references, converted)) continue;
    return converted;
  }
  return value;
}
__name(FromUnion15, 'FromUnion');
function Visit10(schema, references, value) {
  const references_ = IsString4(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema[Kind]) {
    case 'Array':
      return FromArray11(schema_, references_, value);
    case 'BigInt':
      return FromBigInt5(schema_, references_, value);
    case 'Boolean':
      return FromBoolean5(schema_, references_, value);
    case 'Date':
      return FromDate5(schema_, references_, value);
    case 'Integer':
      return FromInteger5(schema_, references_, value);
    case 'Intersect':
      return FromIntersect13(schema_, references_, value);
    case 'Literal':
      return FromLiteral6(schema_, references_, value);
    case 'Null':
      return FromNull5(schema_, references_, value);
    case 'Number':
      return FromNumber5(schema_, references_, value);
    case 'Object':
      return FromObject8(schema_, references_, value);
    case 'Record':
      return FromRecord7(schema_, references_, value);
    case 'Ref':
      return FromRef7(schema_, references_, value);
    case 'String':
      return FromString5(schema_, references_, value);
    case 'Symbol':
      return FromSymbol5(schema_, references_, value);
    case 'This':
      return FromThis6(schema_, references_, value);
    case 'Tuple':
      return FromTuple10(schema_, references_, value);
    case 'Undefined':
      return FromUndefined5(schema_, references_, value);
    case 'Union':
      return FromUnion15(schema_, references_, value);
    default:
      return Default2(value);
  }
}
__name(Visit10, 'Visit');
function Convert(...args) {
  return args.length === 3
    ? Visit10(args[0], args[1], args[2])
    : Visit10(args[0], [], args[1]);
}
__name(Convert, 'Convert');

// node_modules/@sinclair/typebox/build/esm/value/default/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/default/default.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ValueOrDefault(schema, value) {
  return value === void 0 && 'default' in schema
    ? Clone2(schema.default)
    : value;
}
__name(ValueOrDefault, 'ValueOrDefault');
function IsCheckable2(schema) {
  return IsSchema2(schema) && schema[Kind] !== 'Unsafe';
}
__name(IsCheckable2, 'IsCheckable');
function IsDefaultSchema(value) {
  return IsSchema2(value) && 'default' in value;
}
__name(IsDefaultSchema, 'IsDefaultSchema');
function FromArray12(schema, references, value) {
  const defaulted = ValueOrDefault(schema, value);
  if (!IsArray4(defaulted)) return defaulted;
  for (let i = 0; i < defaulted.length; i++) {
    defaulted[i] = Visit11(schema.items, references, defaulted[i]);
  }
  return defaulted;
}
__name(FromArray12, 'FromArray');
function FromIntersect14(schema, references, value) {
  const defaulted = ValueOrDefault(schema, value);
  return schema.allOf.reduce((acc, schema2) => {
    const next = Visit11(schema2, references, defaulted);
    return IsObject4(next) ? { ...acc, ...next } : next;
  }, {});
}
__name(FromIntersect14, 'FromIntersect');
function FromObject9(schema, references, value) {
  const defaulted = ValueOrDefault(schema, value);
  if (!IsObject4(defaulted)) return defaulted;
  const additionalPropertiesSchema = schema.additionalProperties;
  const knownPropertyKeys = Object.getOwnPropertyNames(schema.properties);
  for (const key of knownPropertyKeys) {
    if (!IsDefaultSchema(schema.properties[key])) continue;
    defaulted[key] = Visit11(
      schema.properties[key],
      references,
      defaulted[key]
    );
  }
  if (!IsDefaultSchema(additionalPropertiesSchema)) return defaulted;
  for (const key of Object.getOwnPropertyNames(defaulted)) {
    if (knownPropertyKeys.includes(key)) continue;
    defaulted[key] = Visit11(
      additionalPropertiesSchema,
      references,
      defaulted[key]
    );
  }
  return defaulted;
}
__name(FromObject9, 'FromObject');
function FromRecord8(schema, references, value) {
  const defaulted = ValueOrDefault(schema, value);
  if (!IsObject4(defaulted)) return defaulted;
  const additionalPropertiesSchema = schema.additionalProperties;
  const [propertyKeyPattern, propertySchema] = Object.entries(
    schema.patternProperties
  )[0];
  const knownPropertyKey = new RegExp(propertyKeyPattern);
  for (const key of Object.getOwnPropertyNames(defaulted)) {
    if (!(knownPropertyKey.test(key) && IsDefaultSchema(propertySchema)))
      continue;
    defaulted[key] = Visit11(propertySchema, references, defaulted[key]);
  }
  if (!IsDefaultSchema(additionalPropertiesSchema)) return defaulted;
  for (const key of Object.getOwnPropertyNames(defaulted)) {
    if (knownPropertyKey.test(key)) continue;
    defaulted[key] = Visit11(
      additionalPropertiesSchema,
      references,
      defaulted[key]
    );
  }
  return defaulted;
}
__name(FromRecord8, 'FromRecord');
function FromRef8(schema, references, value) {
  return Visit11(
    Deref2(schema, references),
    references,
    ValueOrDefault(schema, value)
  );
}
__name(FromRef8, 'FromRef');
function FromThis7(schema, references, value) {
  return Visit11(Deref2(schema, references), references, value);
}
__name(FromThis7, 'FromThis');
function FromTuple11(schema, references, value) {
  const defaulted = ValueOrDefault(schema, value);
  if (!IsArray4(defaulted) || IsUndefined4(schema.items)) return defaulted;
  const [items, max] = [
    schema.items,
    Math.max(schema.items.length, defaulted.length),
  ];
  for (let i = 0; i < max; i++) {
    if (i < items.length)
      defaulted[i] = Visit11(items[i], references, defaulted[i]);
  }
  return defaulted;
}
__name(FromTuple11, 'FromTuple');
function FromUnion16(schema, references, value) {
  const defaulted = ValueOrDefault(schema, value);
  for (const inner of schema.anyOf) {
    const result = Visit11(inner, references, defaulted);
    if (IsCheckable2(inner) && Check(inner, result)) {
      return result;
    }
  }
  return defaulted;
}
__name(FromUnion16, 'FromUnion');
function Visit11(schema, references, value) {
  const references_ = IsString4(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  switch (schema_[Kind]) {
    case 'Array':
      return FromArray12(schema_, references_, value);
    case 'Intersect':
      return FromIntersect14(schema_, references_, value);
    case 'Object':
      return FromObject9(schema_, references_, value);
    case 'Record':
      return FromRecord8(schema_, references_, value);
    case 'Ref':
      return FromRef8(schema_, references_, value);
    case 'This':
      return FromThis7(schema_, references_, value);
    case 'Tuple':
      return FromTuple11(schema_, references_, value);
    case 'Union':
      return FromUnion16(schema_, references_, value);
    default:
      return ValueOrDefault(schema_, value);
  }
}
__name(Visit11, 'Visit');
function Default3(...args) {
  return args.length === 3
    ? Visit11(args[0], args[1], args[2])
    : Visit11(args[0], [], args[1]);
}
__name(Default3, 'Default');

// node_modules/@sinclair/typebox/build/esm/value/delta/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/delta/delta.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/pointer/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/pointer/pointer.mjs
var pointer_exports = {};
__export(pointer_exports, {
  Delete: () => Delete3,
  Format: () => Format,
  Get: () => Get3,
  Has: () => Has3,
  Set: () => Set4,
  ValuePointerRootDeleteError: () => ValuePointerRootDeleteError,
  ValuePointerRootSetError: () => ValuePointerRootSetError,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ValuePointerRootSetError = class extends TypeBoxError {
  static {
    __name(this, 'ValuePointerRootSetError');
  }
  constructor(value, path, update) {
    super('Cannot set root value');
    this.value = value;
    this.path = path;
    this.update = update;
  }
};
var ValuePointerRootDeleteError = class extends TypeBoxError {
  static {
    __name(this, 'ValuePointerRootDeleteError');
  }
  constructor(value, path) {
    super('Cannot delete root value');
    this.value = value;
    this.path = path;
  }
};
function Escape2(component) {
  return component.indexOf('~') === -1
    ? component
    : component.replace(/~1/g, '/').replace(/~0/g, '~');
}
__name(Escape2, 'Escape');
function* Format(pointer) {
  if (pointer === '') return;
  let [start, end] = [0, 0];
  for (let i = 0; i < pointer.length; i++) {
    const char = pointer.charAt(i);
    if (char === '/') {
      if (i === 0) {
        start = i + 1;
      } else {
        end = i;
        yield Escape2(pointer.slice(start, end));
        start = i + 1;
      }
    } else {
      end = i;
    }
  }
  yield Escape2(pointer.slice(start));
}
__name(Format, 'Format');
function Set4(value, pointer, update) {
  if (pointer === '')
    throw new ValuePointerRootSetError(value, pointer, update);
  let [owner, next, key] = [null, value, ''];
  for (const component of Format(pointer)) {
    if (next[component] === void 0) next[component] = {};
    owner = next;
    next = next[component];
    key = component;
  }
  owner[key] = update;
}
__name(Set4, 'Set');
function Delete3(value, pointer) {
  if (pointer === '') throw new ValuePointerRootDeleteError(value, pointer);
  let [owner, next, key] = [null, value, ''];
  for (const component of Format(pointer)) {
    if (next[component] === void 0 || next[component] === null) return;
    owner = next;
    next = next[component];
    key = component;
  }
  if (Array.isArray(owner)) {
    const index = parseInt(key);
    owner.splice(index, 1);
  } else {
    delete owner[key];
  }
}
__name(Delete3, 'Delete');
function Has3(value, pointer) {
  if (pointer === '') return true;
  let [owner, next, key] = [null, value, ''];
  for (const component of Format(pointer)) {
    if (next[component] === void 0) return false;
    owner = next;
    next = next[component];
    key = component;
  }
  return Object.getOwnPropertyNames(owner).includes(key);
}
__name(Has3, 'Has');
function Get3(value, pointer) {
  if (pointer === '') return value;
  let current = value;
  for (const component of Format(pointer)) {
    if (current[component] === void 0) return void 0;
    current = current[component];
  }
  return current;
}
__name(Get3, 'Get');

// node_modules/@sinclair/typebox/build/esm/value/delta/delta.mjs
var Insert = Object2({
  type: Literal('insert'),
  path: String2(),
  value: Unknown(),
});
var Update = Object2({
  type: Literal('update'),
  path: String2(),
  value: Unknown(),
});
var Delete4 = Object2({
  type: Literal('delete'),
  path: String2(),
});
var Edit = Union([Insert, Update, Delete4]);
var ValueDeltaError = class extends TypeBoxError {
  static {
    __name(this, 'ValueDeltaError');
  }
  constructor(value, message) {
    super(message);
    this.value = value;
  }
};
var ValueDeltaSymbolError = class extends ValueDeltaError {
  static {
    __name(this, 'ValueDeltaSymbolError');
  }
  constructor(value) {
    super(value, 'Cannot diff objects with symbol keys');
    this.value = value;
  }
};
function CreateUpdate(path, value) {
  return { type: 'update', path, value };
}
__name(CreateUpdate, 'CreateUpdate');
function CreateInsert(path, value) {
  return { type: 'insert', path, value };
}
__name(CreateInsert, 'CreateInsert');
function CreateDelete(path) {
  return { type: 'delete', path };
}
__name(CreateDelete, 'CreateDelete');
function* ObjectType4(path, current, next) {
  if (!IsStandardObject(next)) return yield CreateUpdate(path, next);
  const currentKeys = [
    ...globalThis.Object.keys(current),
    ...globalThis.Object.getOwnPropertySymbols(current),
  ];
  const nextKeys = [
    ...globalThis.Object.keys(next),
    ...globalThis.Object.getOwnPropertySymbols(next),
  ];
  for (const key of currentKeys) {
    if (IsSymbol4(key)) throw new ValueDeltaSymbolError(key);
    if (IsUndefined4(next[key]) && nextKeys.includes(key))
      yield CreateUpdate(`${path}/${globalThis.String(key)}`, void 0);
  }
  for (const key of nextKeys) {
    if (IsUndefined4(current[key]) || IsUndefined4(next[key])) continue;
    if (IsSymbol4(key)) throw new ValueDeltaSymbolError(key);
    yield* Visit12(
      `${path}/${globalThis.String(key)}`,
      current[key],
      next[key]
    );
  }
  for (const key of nextKeys) {
    if (IsSymbol4(key)) throw new ValueDeltaSymbolError(key);
    if (IsUndefined4(current[key]))
      yield CreateInsert(`${path}/${globalThis.String(key)}`, next[key]);
  }
  for (const key of currentKeys.reverse()) {
    if (IsSymbol4(key)) throw new ValueDeltaSymbolError(key);
    if (IsUndefined4(next[key]) && !nextKeys.includes(key))
      yield CreateDelete(`${path}/${globalThis.String(key)}`);
  }
}
__name(ObjectType4, 'ObjectType');
function* ArrayType4(path, current, next) {
  if (!IsArray4(next)) return yield CreateUpdate(path, next);
  for (let i = 0; i < Math.min(current.length, next.length); i++) {
    yield* Visit12(`${path}/${i}`, current[i], next[i]);
  }
  for (let i = 0; i < next.length; i++) {
    if (i < current.length) continue;
    yield CreateInsert(`${path}/${i}`, next[i]);
  }
  for (let i = current.length - 1; i >= 0; i--) {
    if (i < next.length) continue;
    yield CreateDelete(`${path}/${i}`);
  }
}
__name(ArrayType4, 'ArrayType');
function* TypedArrayType2(path, current, next) {
  if (
    !IsTypedArray(next) ||
    current.length !== next.length ||
    globalThis.Object.getPrototypeOf(current).constructor.name !==
      globalThis.Object.getPrototypeOf(next).constructor.name
  )
    return yield CreateUpdate(path, next);
  for (let i = 0; i < Math.min(current.length, next.length); i++) {
    yield* Visit12(`${path}/${i}`, current[i], next[i]);
  }
}
__name(TypedArrayType2, 'TypedArrayType');
function* ValueType2(path, current, next) {
  if (current === next) return;
  yield CreateUpdate(path, next);
}
__name(ValueType2, 'ValueType');
function* Visit12(path, current, next) {
  if (IsStandardObject(current)) return yield* ObjectType4(path, current, next);
  if (IsArray4(current)) return yield* ArrayType4(path, current, next);
  if (IsTypedArray(current)) return yield* TypedArrayType2(path, current, next);
  if (IsValueType(current)) return yield* ValueType2(path, current, next);
  throw new ValueDeltaError(
    current,
    'Unable to create diff edits for unknown value'
  );
}
__name(Visit12, 'Visit');
function Diff(current, next) {
  return [...Visit12('', current, next)];
}
__name(Diff, 'Diff');
function IsRootUpdate(edits) {
  return edits.length > 0 && edits[0].path === '' && edits[0].type === 'update';
}
__name(IsRootUpdate, 'IsRootUpdate');
function IsIdentity(edits) {
  return edits.length === 0;
}
__name(IsIdentity, 'IsIdentity');
function Patch(current, edits) {
  if (IsRootUpdate(edits)) {
    return Clone2(edits[0].value);
  }
  if (IsIdentity(edits)) {
    return Clone2(current);
  }
  const clone = Clone2(current);
  for (const edit of edits) {
    switch (edit.type) {
      case 'insert': {
        pointer_exports.Set(clone, edit.path, edit.value);
        break;
      }
      case 'update': {
        pointer_exports.Set(clone, edit.path, edit.value);
        break;
      }
      case 'delete': {
        pointer_exports.Delete(clone, edit.path);
        break;
      }
    }
  }
  return clone;
}
__name(Patch, 'Patch');

// node_modules/@sinclair/typebox/build/esm/value/equal/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/equal/equal.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ObjectType5(left, right) {
  if (!IsStandardObject(right)) return false;
  const leftKeys = [
    ...Object.keys(left),
    ...Object.getOwnPropertySymbols(left),
  ];
  const rightKeys = [
    ...Object.keys(right),
    ...Object.getOwnPropertySymbols(right),
  ];
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Equal(left[key], right[key]));
}
__name(ObjectType5, 'ObjectType');
function DateType4(left, right) {
  return IsDate4(right) && left.getTime() === right.getTime();
}
__name(DateType4, 'DateType');
function ArrayType5(left, right) {
  if (!IsArray4(right) || left.length !== right.length) return false;
  return left.every((value, index) => Equal(value, right[index]));
}
__name(ArrayType5, 'ArrayType');
function TypedArrayType3(left, right) {
  if (
    !IsTypedArray(right) ||
    left.length !== right.length ||
    Object.getPrototypeOf(left).constructor.name !==
      Object.getPrototypeOf(right).constructor.name
  )
    return false;
  return left.every((value, index) => Equal(value, right[index]));
}
__name(TypedArrayType3, 'TypedArrayType');
function ValueType3(left, right) {
  return left === right;
}
__name(ValueType3, 'ValueType');
function Equal(left, right) {
  if (IsStandardObject(left)) return ObjectType5(left, right);
  if (IsDate4(left)) return DateType4(left, right);
  if (IsTypedArray(left)) return TypedArrayType3(left, right);
  if (IsArray4(left)) return ArrayType5(left, right);
  if (IsValueType(left)) return ValueType3(left, right);
  throw new Error('ValueEquals: Unable to compare value');
}
__name(Equal, 'Equal');

// node_modules/@sinclair/typebox/build/esm/value/mutate/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/mutate/mutate.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ValueMutateError = class extends TypeBoxError {
  static {
    __name(this, 'ValueMutateError');
  }
  constructor(message) {
    super(message);
  }
};
function ObjectType6(root, path, current, next) {
  if (!IsStandardObject(current)) {
    pointer_exports.Set(root, path, Clone2(next));
  } else {
    const currentKeys = Object.getOwnPropertyNames(current);
    const nextKeys = Object.getOwnPropertyNames(next);
    for (const currentKey of currentKeys) {
      if (!nextKeys.includes(currentKey)) {
        delete current[currentKey];
      }
    }
    for (const nextKey of nextKeys) {
      if (!currentKeys.includes(nextKey)) {
        current[nextKey] = null;
      }
    }
    for (const nextKey of nextKeys) {
      Visit13(root, `${path}/${nextKey}`, current[nextKey], next[nextKey]);
    }
  }
}
__name(ObjectType6, 'ObjectType');
function ArrayType6(root, path, current, next) {
  if (!IsArray4(current)) {
    pointer_exports.Set(root, path, Clone2(next));
  } else {
    for (let index = 0; index < next.length; index++) {
      Visit13(root, `${path}/${index}`, current[index], next[index]);
    }
    current.splice(next.length);
  }
}
__name(ArrayType6, 'ArrayType');
function TypedArrayType4(root, path, current, next) {
  if (IsTypedArray(current) && current.length === next.length) {
    for (let i = 0; i < current.length; i++) {
      current[i] = next[i];
    }
  } else {
    pointer_exports.Set(root, path, Clone2(next));
  }
}
__name(TypedArrayType4, 'TypedArrayType');
function ValueType4(root, path, current, next) {
  if (current === next) return;
  pointer_exports.Set(root, path, next);
}
__name(ValueType4, 'ValueType');
function Visit13(root, path, current, next) {
  if (IsArray4(next)) return ArrayType6(root, path, current, next);
  if (IsTypedArray(next)) return TypedArrayType4(root, path, current, next);
  if (IsStandardObject(next)) return ObjectType6(root, path, current, next);
  if (IsValueType(next)) return ValueType4(root, path, current, next);
}
__name(Visit13, 'Visit');
function IsNonMutableValue(value) {
  return IsTypedArray(value) || IsValueType(value);
}
__name(IsNonMutableValue, 'IsNonMutableValue');
function IsMismatchedValue(current, next) {
  return (
    (IsStandardObject(current) && IsArray4(next)) ||
    (IsArray4(current) && IsStandardObject(next))
  );
}
__name(IsMismatchedValue, 'IsMismatchedValue');
function Mutate(current, next) {
  if (IsNonMutableValue(current) || IsNonMutableValue(next))
    throw new ValueMutateError(
      'Only object and array types can be mutated at the root level'
    );
  if (IsMismatchedValue(current, next))
    throw new ValueMutateError(
      'Cannot assign due type mismatch of assignable values'
    );
  Visit13(current, '', current, next);
}
__name(Mutate, 'Mutate');

// node_modules/@sinclair/typebox/build/esm/value/transform/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/transform/decode.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TransformDecodeCheckError = class extends TypeBoxError {
  static {
    __name(this, 'TransformDecodeCheckError');
  }
  constructor(schema, value, error3) {
    super(`Unable to decode value as it does not match the expected schema`);
    this.schema = schema;
    this.value = value;
    this.error = error3;
  }
};
var TransformDecodeError = class extends TypeBoxError {
  static {
    __name(this, 'TransformDecodeError');
  }
  constructor(schema, path, value, error3) {
    super(error3 instanceof Error ? error3.message : 'Unknown error');
    this.schema = schema;
    this.path = path;
    this.value = value;
    this.error = error3;
  }
};
function Default4(schema, path, value) {
  try {
    return IsTransform2(schema) ? schema[TransformKind].Decode(value) : value;
  } catch (error3) {
    throw new TransformDecodeError(schema, path, value, error3);
  }
}
__name(Default4, 'Default');
function FromArray13(schema, references, path, value) {
  return IsArray4(value)
    ? Default4(
        schema,
        path,
        value.map((value2, index) =>
          Visit14(schema.items, references, `${path}/${index}`, value2)
        )
      )
    : Default4(schema, path, value);
}
__name(FromArray13, 'FromArray');
function FromIntersect15(schema, references, path, value) {
  if (!IsStandardObject(value) || IsValueType(value))
    return Default4(schema, path, value);
  const knownEntries = KeyOfPropertyEntries(schema);
  const knownKeys = knownEntries.map((entry) => entry[0]);
  const knownProperties = { ...value };
  for (const [knownKey, knownSchema] of knownEntries)
    if (knownKey in knownProperties) {
      knownProperties[knownKey] = Visit14(
        knownSchema,
        references,
        `${path}/${knownKey}`,
        knownProperties[knownKey]
      );
    }
  if (!IsTransform2(schema.unevaluatedProperties)) {
    return Default4(schema, path, knownProperties);
  }
  const unknownKeys = Object.getOwnPropertyNames(knownProperties);
  const unevaluatedProperties = schema.unevaluatedProperties;
  const unknownProperties = { ...knownProperties };
  for (const key of unknownKeys)
    if (!knownKeys.includes(key)) {
      unknownProperties[key] = Default4(
        unevaluatedProperties,
        `${path}/${key}`,
        unknownProperties[key]
      );
    }
  return Default4(schema, path, unknownProperties);
}
__name(FromIntersect15, 'FromIntersect');
function FromNot5(schema, references, path, value) {
  return Default4(schema, path, Visit14(schema.not, references, path, value));
}
__name(FromNot5, 'FromNot');
function FromObject10(schema, references, path, value) {
  if (!IsStandardObject(value)) return Default4(schema, path, value);
  const knownKeys = KeyOfPropertyKeys(schema);
  const knownProperties = { ...value };
  for (const key of knownKeys)
    if (key in knownProperties) {
      knownProperties[key] = Visit14(
        schema.properties[key],
        references,
        `${path}/${key}`,
        knownProperties[key]
      );
    }
  if (!IsSchema2(schema.additionalProperties)) {
    return Default4(schema, path, knownProperties);
  }
  const unknownKeys = Object.getOwnPropertyNames(knownProperties);
  const additionalProperties = schema.additionalProperties;
  const unknownProperties = { ...knownProperties };
  for (const key of unknownKeys)
    if (!knownKeys.includes(key)) {
      unknownProperties[key] = Default4(
        additionalProperties,
        `${path}/${key}`,
        unknownProperties[key]
      );
    }
  return Default4(schema, path, unknownProperties);
}
__name(FromObject10, 'FromObject');
function FromRecord9(schema, references, path, value) {
  if (!IsStandardObject(value)) return Default4(schema, path, value);
  const pattern = Object.getOwnPropertyNames(schema.patternProperties)[0];
  const knownKeys = new RegExp(pattern);
  const knownProperties = { ...value };
  for (const key of Object.getOwnPropertyNames(value))
    if (knownKeys.test(key)) {
      knownProperties[key] = Visit14(
        schema.patternProperties[pattern],
        references,
        `${path}/${key}`,
        knownProperties[key]
      );
    }
  if (!IsSchema2(schema.additionalProperties)) {
    return Default4(schema, path, knownProperties);
  }
  const unknownKeys = Object.getOwnPropertyNames(knownProperties);
  const additionalProperties = schema.additionalProperties;
  const unknownProperties = { ...knownProperties };
  for (const key of unknownKeys)
    if (!knownKeys.test(key)) {
      unknownProperties[key] = Default4(
        additionalProperties,
        `${path}/${key}`,
        unknownProperties[key]
      );
    }
  return Default4(schema, path, unknownProperties);
}
__name(FromRecord9, 'FromRecord');
function FromRef9(schema, references, path, value) {
  const target = Deref2(schema, references);
  return Default4(schema, path, Visit14(target, references, path, value));
}
__name(FromRef9, 'FromRef');
function FromThis8(schema, references, path, value) {
  const target = Deref2(schema, references);
  return Default4(schema, path, Visit14(target, references, path, value));
}
__name(FromThis8, 'FromThis');
function FromTuple12(schema, references, path, value) {
  return IsArray4(value) && IsArray4(schema.items)
    ? Default4(
        schema,
        path,
        schema.items.map((schema2, index) =>
          Visit14(schema2, references, `${path}/${index}`, value[index])
        )
      )
    : Default4(schema, path, value);
}
__name(FromTuple12, 'FromTuple');
function FromUnion17(schema, references, path, value) {
  for (const subschema of schema.anyOf) {
    if (!Check(subschema, references, value)) continue;
    const decoded = Visit14(subschema, references, path, value);
    return Default4(schema, path, decoded);
  }
  return Default4(schema, path, value);
}
__name(FromUnion17, 'FromUnion');
function Visit14(schema, references, path, value) {
  const references_ =
    typeof schema.$id === 'string' ? [...references, schema] : references;
  const schema_ = schema;
  switch (schema[Kind]) {
    case 'Array':
      return FromArray13(schema_, references_, path, value);
    case 'Intersect':
      return FromIntersect15(schema_, references_, path, value);
    case 'Not':
      return FromNot5(schema_, references_, path, value);
    case 'Object':
      return FromObject10(schema_, references_, path, value);
    case 'Record':
      return FromRecord9(schema_, references_, path, value);
    case 'Ref':
      return FromRef9(schema_, references_, path, value);
    case 'Symbol':
      return Default4(schema_, path, value);
    case 'This':
      return FromThis8(schema_, references_, path, value);
    case 'Tuple':
      return FromTuple12(schema_, references_, path, value);
    case 'Union':
      return FromUnion17(schema_, references_, path, value);
    default:
      return Default4(schema_, path, value);
  }
}
__name(Visit14, 'Visit');
function TransformDecode(schema, references, value) {
  return Visit14(schema, references, '', value);
}
__name(TransformDecode, 'TransformDecode');

// node_modules/@sinclair/typebox/build/esm/value/transform/encode.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TransformEncodeCheckError = class extends TypeBoxError {
  static {
    __name(this, 'TransformEncodeCheckError');
  }
  constructor(schema, value, error3) {
    super(`The encoded value does not match the expected schema`);
    this.schema = schema;
    this.value = value;
    this.error = error3;
  }
};
var TransformEncodeError = class extends TypeBoxError {
  static {
    __name(this, 'TransformEncodeError');
  }
  constructor(schema, path, value, error3) {
    super(`${error3 instanceof Error ? error3.message : 'Unknown error'}`);
    this.schema = schema;
    this.path = path;
    this.value = value;
    this.error = error3;
  }
};
function Default5(schema, path, value) {
  try {
    return IsTransform2(schema) ? schema[TransformKind].Encode(value) : value;
  } catch (error3) {
    throw new TransformEncodeError(schema, path, value, error3);
  }
}
__name(Default5, 'Default');
function FromArray14(schema, references, path, value) {
  const defaulted = Default5(schema, path, value);
  return IsArray4(defaulted)
    ? defaulted.map((value2, index) =>
        Visit15(schema.items, references, `${path}/${index}`, value2)
      )
    : defaulted;
}
__name(FromArray14, 'FromArray');
function FromIntersect16(schema, references, path, value) {
  const defaulted = Default5(schema, path, value);
  if (!IsStandardObject(value) || IsValueType(value)) return defaulted;
  const knownEntries = KeyOfPropertyEntries(schema);
  const knownKeys = knownEntries.map((entry) => entry[0]);
  const knownProperties = { ...defaulted };
  for (const [knownKey, knownSchema] of knownEntries)
    if (knownKey in knownProperties) {
      knownProperties[knownKey] = Visit15(
        knownSchema,
        references,
        `${path}/${knownKey}`,
        knownProperties[knownKey]
      );
    }
  if (!IsTransform2(schema.unevaluatedProperties)) {
    return Default5(schema, path, knownProperties);
  }
  const unknownKeys = Object.getOwnPropertyNames(knownProperties);
  const unevaluatedProperties = schema.unevaluatedProperties;
  const properties = { ...knownProperties };
  for (const key of unknownKeys)
    if (!knownKeys.includes(key)) {
      properties[key] = Default5(
        unevaluatedProperties,
        `${path}/${key}`,
        properties[key]
      );
    }
  return properties;
}
__name(FromIntersect16, 'FromIntersect');
function FromNot6(schema, references, path, value) {
  return Default5(schema.not, path, Default5(schema, path, value));
}
__name(FromNot6, 'FromNot');
function FromObject11(schema, references, path, value) {
  const defaulted = Default5(schema, path, value);
  if (!IsStandardObject(defaulted)) return defaulted;
  const knownKeys = KeyOfPropertyKeys(schema);
  const knownProperties = { ...defaulted };
  for (const key of knownKeys)
    if (key in knownProperties) {
      knownProperties[key] = Visit15(
        schema.properties[key],
        references,
        `${path}/${key}`,
        knownProperties[key]
      );
    }
  if (!IsSchema2(schema.additionalProperties)) {
    return knownProperties;
  }
  const unknownKeys = Object.getOwnPropertyNames(knownProperties);
  const additionalProperties = schema.additionalProperties;
  const properties = { ...knownProperties };
  for (const key of unknownKeys)
    if (!knownKeys.includes(key)) {
      properties[key] = Default5(
        additionalProperties,
        `${path}/${key}`,
        properties[key]
      );
    }
  return properties;
}
__name(FromObject11, 'FromObject');
function FromRecord10(schema, references, path, value) {
  const defaulted = Default5(schema, path, value);
  if (!IsStandardObject(value)) return defaulted;
  const pattern = Object.getOwnPropertyNames(schema.patternProperties)[0];
  const knownKeys = new RegExp(pattern);
  const knownProperties = { ...defaulted };
  for (const key of Object.getOwnPropertyNames(value))
    if (knownKeys.test(key)) {
      knownProperties[key] = Visit15(
        schema.patternProperties[pattern],
        references,
        `${path}/${key}`,
        knownProperties[key]
      );
    }
  if (!IsSchema2(schema.additionalProperties)) {
    return Default5(schema, path, knownProperties);
  }
  const unknownKeys = Object.getOwnPropertyNames(knownProperties);
  const additionalProperties = schema.additionalProperties;
  const properties = { ...knownProperties };
  for (const key of unknownKeys)
    if (!knownKeys.test(key)) {
      properties[key] = Default5(
        additionalProperties,
        `${path}/${key}`,
        properties[key]
      );
    }
  return properties;
}
__name(FromRecord10, 'FromRecord');
function FromRef10(schema, references, path, value) {
  const target = Deref2(schema, references);
  const resolved = Visit15(target, references, path, value);
  return Default5(schema, path, resolved);
}
__name(FromRef10, 'FromRef');
function FromThis9(schema, references, path, value) {
  const target = Deref2(schema, references);
  const resolved = Visit15(target, references, path, value);
  return Default5(schema, path, resolved);
}
__name(FromThis9, 'FromThis');
function FromTuple13(schema, references, path, value) {
  const value1 = Default5(schema, path, value);
  return IsArray4(schema.items)
    ? schema.items.map((schema2, index) =>
        Visit15(schema2, references, `${path}/${index}`, value1[index])
      )
    : [];
}
__name(FromTuple13, 'FromTuple');
function FromUnion18(schema, references, path, value) {
  for (const subschema of schema.anyOf) {
    if (!Check(subschema, references, value)) continue;
    const value1 = Visit15(subschema, references, path, value);
    return Default5(schema, path, value1);
  }
  for (const subschema of schema.anyOf) {
    const value1 = Visit15(subschema, references, path, value);
    if (!Check(schema, references, value1)) continue;
    return Default5(schema, path, value1);
  }
  return Default5(schema, path, value);
}
__name(FromUnion18, 'FromUnion');
function Visit15(schema, references, path, value) {
  const references_ =
    typeof schema.$id === 'string' ? [...references, schema] : references;
  const schema_ = schema;
  switch (schema[Kind]) {
    case 'Array':
      return FromArray14(schema_, references_, path, value);
    case 'Intersect':
      return FromIntersect16(schema_, references_, path, value);
    case 'Not':
      return FromNot6(schema_, references_, path, value);
    case 'Object':
      return FromObject11(schema_, references_, path, value);
    case 'Record':
      return FromRecord10(schema_, references_, path, value);
    case 'Ref':
      return FromRef10(schema_, references_, path, value);
    case 'This':
      return FromThis9(schema_, references_, path, value);
    case 'Tuple':
      return FromTuple13(schema_, references_, path, value);
    case 'Union':
      return FromUnion18(schema_, references_, path, value);
    default:
      return Default5(schema_, path, value);
  }
}
__name(Visit15, 'Visit');
function TransformEncode(schema, references, value) {
  return Visit15(schema, references, '', value);
}
__name(TransformEncode, 'TransformEncode');

// node_modules/@sinclair/typebox/build/esm/value/transform/has.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function FromArray15(schema, references) {
  return IsTransform2(schema) || Visit16(schema.items, references);
}
__name(FromArray15, 'FromArray');
function FromAsyncIterator6(schema, references) {
  return IsTransform2(schema) || Visit16(schema.items, references);
}
__name(FromAsyncIterator6, 'FromAsyncIterator');
function FromConstructor7(schema, references) {
  return (
    IsTransform2(schema) ||
    Visit16(schema.returns, references) ||
    schema.parameters.some((schema2) => Visit16(schema2, references))
  );
}
__name(FromConstructor7, 'FromConstructor');
function FromFunction6(schema, references) {
  return (
    IsTransform2(schema) ||
    Visit16(schema.returns, references) ||
    schema.parameters.some((schema2) => Visit16(schema2, references))
  );
}
__name(FromFunction6, 'FromFunction');
function FromIntersect17(schema, references) {
  return (
    IsTransform2(schema) ||
    IsTransform2(schema.unevaluatedProperties) ||
    schema.allOf.some((schema2) => Visit16(schema2, references))
  );
}
__name(FromIntersect17, 'FromIntersect');
function FromIterator6(schema, references) {
  return IsTransform2(schema) || Visit16(schema.items, references);
}
__name(FromIterator6, 'FromIterator');
function FromNot7(schema, references) {
  return IsTransform2(schema) || Visit16(schema.not, references);
}
__name(FromNot7, 'FromNot');
function FromObject12(schema, references) {
  return (
    IsTransform2(schema) ||
    Object.values(schema.properties).some((schema2) =>
      Visit16(schema2, references)
    ) ||
    (IsSchema2(schema.additionalProperties) &&
      Visit16(schema.additionalProperties, references))
  );
}
__name(FromObject12, 'FromObject');
function FromPromise7(schema, references) {
  return IsTransform2(schema) || Visit16(schema.item, references);
}
__name(FromPromise7, 'FromPromise');
function FromRecord11(schema, references) {
  const pattern = Object.getOwnPropertyNames(schema.patternProperties)[0];
  const property = schema.patternProperties[pattern];
  return (
    IsTransform2(schema) ||
    Visit16(property, references) ||
    (IsSchema2(schema.additionalProperties) &&
      IsTransform2(schema.additionalProperties))
  );
}
__name(FromRecord11, 'FromRecord');
function FromRef11(schema, references) {
  if (IsTransform2(schema)) return true;
  return Visit16(Deref2(schema, references), references);
}
__name(FromRef11, 'FromRef');
function FromThis10(schema, references) {
  if (IsTransform2(schema)) return true;
  return Visit16(Deref2(schema, references), references);
}
__name(FromThis10, 'FromThis');
function FromTuple14(schema, references) {
  return (
    IsTransform2(schema) ||
    (!IsUndefined4(schema.items) &&
      schema.items.some((schema2) => Visit16(schema2, references)))
  );
}
__name(FromTuple14, 'FromTuple');
function FromUnion19(schema, references) {
  return (
    IsTransform2(schema) ||
    schema.anyOf.some((schema2) => Visit16(schema2, references))
  );
}
__name(FromUnion19, 'FromUnion');
function Visit16(schema, references) {
  const references_ = IsString4(schema.$id)
    ? [...references, schema]
    : references;
  const schema_ = schema;
  if (schema.$id && visited.has(schema.$id)) return false;
  if (schema.$id) visited.add(schema.$id);
  switch (schema[Kind]) {
    case 'Array':
      return FromArray15(schema_, references_);
    case 'AsyncIterator':
      return FromAsyncIterator6(schema_, references_);
    case 'Constructor':
      return FromConstructor7(schema_, references_);
    case 'Function':
      return FromFunction6(schema_, references_);
    case 'Intersect':
      return FromIntersect17(schema_, references_);
    case 'Iterator':
      return FromIterator6(schema_, references_);
    case 'Not':
      return FromNot7(schema_, references_);
    case 'Object':
      return FromObject12(schema_, references_);
    case 'Promise':
      return FromPromise7(schema_, references_);
    case 'Record':
      return FromRecord11(schema_, references_);
    case 'Ref':
      return FromRef11(schema_, references_);
    case 'This':
      return FromThis10(schema_, references_);
    case 'Tuple':
      return FromTuple14(schema_, references_);
    case 'Union':
      return FromUnion19(schema_, references_);
    default:
      return IsTransform2(schema);
  }
}
__name(Visit16, 'Visit');
var visited = /* @__PURE__ */ new Set();
function HasTransform(schema, references) {
  visited.clear();
  return Visit16(schema, references);
}
__name(HasTransform, 'HasTransform');

// node_modules/@sinclair/typebox/build/esm/value/value/index.mjs
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/@sinclair/typebox/build/esm/value/value/value.mjs
var value_exports2 = {};
__export(value_exports2, {
  Cast: () => Cast2,
  Check: () => Check2,
  Clean: () => Clean2,
  Clone: () => Clone3,
  Convert: () => Convert2,
  Create: () => Create3,
  Decode: () => Decode,
  Default: () => Default6,
  Diff: () => Diff2,
  Encode: () => Encode,
  Equal: () => Equal2,
  Errors: () => Errors2,
  Hash: () => Hash2,
  Mutate: () => Mutate2,
  Patch: () => Patch2,
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function Cast2(...args) {
  return Cast.apply(Cast, args);
}
__name(Cast2, 'Cast');
function Create3(...args) {
  return Create2.apply(Create2, args);
}
__name(Create3, 'Create');
function Check2(...args) {
  return Check.apply(Check, args);
}
__name(Check2, 'Check');
function Clean2(...args) {
  return Clean.apply(Clean, args);
}
__name(Clean2, 'Clean');
function Convert2(...args) {
  return Convert.apply(Convert, args);
}
__name(Convert2, 'Convert');
function Clone3(value) {
  return Clone2(value);
}
__name(Clone3, 'Clone');
function Decode(...args) {
  const [schema, references, value] =
    args.length === 3 ? [args[0], args[1], args[2]] : [args[0], [], args[1]];
  if (!Check2(schema, references, value))
    throw new TransformDecodeCheckError(
      schema,
      value,
      Errors2(schema, references, value).First()
    );
  return HasTransform(schema, references)
    ? TransformDecode(schema, references, value)
    : value;
}
__name(Decode, 'Decode');
function Default6(...args) {
  return Default3.apply(Default3, args);
}
__name(Default6, 'Default');
function Encode(...args) {
  const [schema, references, value] =
    args.length === 3 ? [args[0], args[1], args[2]] : [args[0], [], args[1]];
  const encoded = HasTransform(schema, references)
    ? TransformEncode(schema, references, value)
    : value;
  if (!Check2(schema, references, encoded))
    throw new TransformEncodeCheckError(
      schema,
      encoded,
      Errors2(schema, references, encoded).First()
    );
  return encoded;
}
__name(Encode, 'Encode');
function Errors2(...args) {
  return Errors.apply(Errors, args);
}
__name(Errors2, 'Errors');
function Equal2(left, right) {
  return Equal(left, right);
}
__name(Equal2, 'Equal');
function Diff2(current, next) {
  return Diff(current, next);
}
__name(Diff2, 'Diff');
function Hash2(value) {
  return Hash(value);
}
__name(Hash2, 'Hash');
function Patch2(current, edits) {
  return Patch(current, edits);
}
__name(Patch2, 'Patch');
function Mutate2(current, next) {
  Mutate(current, next);
}
__name(Mutate2, 'Mutate');

// node_modules/yahoo-finance2/dist/esm/src/lib/validateAndCoerceTypes.js
function logRelevantErrorInfo(e) {
  const {
    /* schema, */
    error: error3,
    /* , value */
  } = e;
  console.log(JSON.stringify(error3, null, 2));
}
__name(logRelevantErrorInfo, 'logRelevantErrorInfo');
var handleResultError = /* @__PURE__ */ __name((e, options3) => {
  const title2 = e.schema.title;
  if (options3.logErrors) {
    logRelevantErrorInfo(e);
    console.log(`
    This may happen intermittently and you should catch errors appropriately.
    However:  1) if this recently started happening on every request for a symbol
    that used to work, Yahoo may have changed their API.  2) If this happens on
    every request for a symbol you've never used before, but not for other
    symbols, you've found an edge-case (OR, we may just be protecting you from
    "bad" data sometimes stored for e.g. misspelt symbols on Yahoo's side).
    Please see if anyone has reported this previously:
    
      ${package_default.repository}/issues?q=is%3Aissue+${title2}
    
    or open a new issue (and mention the symbol):  ${package_default.name} v${package_default.version}
    
      ${package_default.repository}/issues/new?labels=bug%2C+validation&template=validation.md&title=${title2}
    
    For information on how to turn off the above logging or skip these errors,
    see https://github.com/gadicc/node-yahoo-finance2/tree/devel/docs/validation.md.
    
    At the end of the doc, there's also a section on how to
    [Help Fix Validation Errors](https://github.com/gadicc/node-yahoo-finance2/blob/devel/docs/validation.md#help-fix)
    in case you'd like to contribute to the project.  Most of the time, these
    fixes are very quick and easy; it's just hard for our small core team to keep up,
    so help is always appreciated!
    `);
  }
  throw new FailedYahooValidationError('Failed Yahoo Schema validation', {
    result: e.value,
    errors: [e],
  });
}, 'handleResultError');
var handleOptionsError = /* @__PURE__ */ __name((e, { logOptionsErrors }) => {
  if (logOptionsErrors) {
    console.error(
      `[yahooFinance] Invalid options ("${JSON.stringify(e.error, null, 2)}")`
    );
  }
  throw new InvalidOptionsError('Validation called with invalid options');
}, 'handleOptionsError');
var validateAndCoerceTypebox = /* @__PURE__ */ __name(
  ({ type, data, schema, options: options3 }) => {
    try {
      const validationSchema = options3._internalThrowOnAdditionalProperties
        ? { ...schema, additionalProperties: false }
        : schema;
      return value_exports2.Decode(validationSchema, data);
    } catch (e) {
      if (
        e instanceof TransformDecodeError ||
        e instanceof TransformDecodeCheckError
      ) {
        type === 'result'
          ? handleResultError(e, options3)
          : handleOptionsError(e, options3);
      }
      throw e;
    }
  },
  'validateAndCoerceTypebox'
);
var validateAndCoerceTypes_default = validateAndCoerceTypebox;

// node_modules/yahoo-finance2/dist/esm/src/lib/setGlobalConfig.js
function setGlobalConfig(_config) {
  const parsed = validateAndCoerceTypes_default({
    data: _config,
    type: 'options',
    options: this._opts.validation,
    schema: YahooFinanceOptionsSchema,
  });
  const { cookieJar, ...config2 } = parsed;
  mergeObjects(this._opts, config2);
  if (cookieJar) {
    if (!(cookieJar instanceof ExtendedCookieJar))
      throw new Error('cookieJar must be an instance of ExtendedCookieJar');
    this._opts.cookieJar = cookieJar;
  }
}
__name(setGlobalConfig, 'setGlobalConfig');
function mergeObjects(original, objToMerge) {
  const ownKeys = Reflect.ownKeys(objToMerge);
  for (const key of ownKeys) {
    if (typeof objToMerge[key] === 'object') {
      mergeObjects(original[key], objToMerge[key]);
    } else {
      original[key] = objToMerge[key];
    }
  }
}
__name(mergeObjects, 'mergeObjects');

// node_modules/yahoo-finance2/dist/esm/src/lib/moduleExec.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/csv2json.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DELIMITER = ',';
function camelize(str) {
  return str
    .split(' ')
    .map((str2, i) =>
      i === 0
        ? str2.toLowerCase()
        : str2[0].toUpperCase() + str2.substr(1).toLowerCase()
    )
    .join('');
}
__name(camelize, 'camelize');
function convert(input) {
  if (input.match(/\d{4,4}-\d{2,2}-\d{2,2}/)) return new Date(input);
  if (input.match(/^[0-9\.]+$/)) return parseFloat(input);
  if (input === 'null') return null;
  return input;
}
__name(convert, 'convert');
function csv2json(csv) {
  const lines = csv.split('\n');
  const headers = lines.shift().split(DELIMITER).map(camelize);
  const out = new Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const inRow = lines[i].split(DELIMITER);
    const outRow = (out[i] = {});
    for (let j = 0; j < inRow.length; j++) {
      outRow[headers[j]] = convert(inRow[j]);
    }
  }
  return out;
}
__name(csv2json, 'csv2json');

// node_modules/yahoo-finance2/dist/esm/src/lib/moduleExec.js
async function moduleExec(opts) {
  var _a, _b;
  const queryOpts = opts.query;
  const moduleOpts = opts.moduleOptions;
  const moduleName = opts.moduleName;
  const resultOpts = opts.result;
  if (queryOpts.assertSymbol) {
    const symbol = queryOpts.assertSymbol;
    if (typeof symbol !== 'string')
      throw new Error(
        `yahooFinance.${moduleName}() expects a single string symbol as its query, not a(n) ${typeof symbol}: ${JSON.stringify(symbol)}`
      );
  }
  validateAndCoerceTypebox({
    type: 'options',
    data: (_a = queryOpts.overrides) !== null && _a !== void 0 ? _a : {},
    schema: queryOpts.schema,
    options: this._opts.validation,
  });
  let queryOptions = {
    ...queryOpts.defaults,
    // Module defaults e.g. { period: '1wk', lang: 'en' }
    ...queryOpts.runtime,
    // Runtime params e.g. { q: query }
    ...queryOpts.overrides,
    // User supplied options that override above
  };
  if (queryOpts.transformWith) {
    queryOptions = queryOpts.transformWith(queryOptions);
  }
  let result = await this._fetch(
    queryOpts.url,
    queryOptions,
    moduleOpts,
    queryOpts.fetchType,
    (_b = queryOpts.needsCrumb) !== null && _b !== void 0 ? _b : false
  );
  if (queryOpts.fetchType === 'csv') {
    result = csv2json(result);
  }
  if (resultOpts.transformWith) {
    result = resultOpts.transformWith(result);
  }
  const validateResult =
    !moduleOpts ||
    moduleOpts.validateResult === void 0 ||
    moduleOpts.validateResult === true;
  const validationOpts = {
    ...this._opts.validation,
    // Set logErrors=false if validateResult=false
    logErrors: validateResult ? this._opts.validation.logErrors : false,
  };
  try {
    return validateAndCoerceTypebox({
      type: 'result',
      data: result,
      schema: resultOpts.schema,
      options: validationOpts,
    });
  } catch (error3) {
    if (validateResult) throw error3;
  }
  return result;
}
__name(moduleExec, 'moduleExec');
var moduleExec_default = moduleExec;

// node_modules/yahoo-finance2/dist/esm/src/modules/autoc.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function autoc() {
  throw new Error(
    'Yahoo decomissioned their autoc server sometime before 20 Nov 2021 (see https://github.com/gadicc/node-yahoo-finance2/issues/337])). Use `search` instead (just like they do).'
  );
}
__name(autoc, 'autoc');

// node_modules/yahoo-finance2/dist/esm/src/modules/chart.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/yahooFinanceTypes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/datetime.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
var YEAR = /^(\d\d\d\d)$/;
var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
var DATE_TIME_SEPARATOR = /t|\s/i;
function IsLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
__name(IsLeapYear, 'IsLeapYear');
var isYear = /* @__PURE__ */ __name((value) => {
  const matches = YEAR.exec(value);
  return !!matches;
}, 'isYear');
var isDate = /* @__PURE__ */ __name((value) => {
  const matches = DATE.exec(value);
  if (!matches) return false;
  const year = +matches[1];
  const month = +matches[2];
  const day = +matches[3];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (month === 2 && IsLeapYear(year) ? 29 : DAYS[month])
  );
}, 'isDate');
var isTime = /* @__PURE__ */ __name((value, strictTimeZone) => {
  const matches = TIME.exec(value);
  if (!matches) return false;
  const hr = +matches[1];
  const min = +matches[2];
  const sec = +matches[3];
  const tz = matches[4];
  const tzSign = matches[5] === '-' ? -1 : 1;
  const tzH = +(matches[6] || 0);
  const tzM = +(matches[7] || 0);
  if (tzH > 23 || tzM > 59 || (strictTimeZone && !tz)) return false;
  if (hr <= 23 && min <= 59 && sec < 60) return true;
  const utcMin = min - tzM * tzSign;
  const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
  return (
    (utcHr === 23 || utcHr === -1) &&
    (utcMin === 59 || utcMin === -1) &&
    sec < 61
  );
}, 'isTime');
var isDateTime = /* @__PURE__ */ __name((value, strictTimeZone) => {
  const dateTime = value.split(DATE_TIME_SEPARATOR);
  return (
    dateTime.length === 2 &&
    isDate(dateTime[0]) &&
    isTime(dateTime[1], strictTimeZone)
  );
}, 'isDateTime');

// node_modules/yahoo-finance2/dist/esm/src/lib/yahooFinanceTypes.js
format_exports.Set('date', isDate);
format_exports.Set('date-time', isDateTime);
format_exports.Set('year', isYear);
var EmptyObjectCoerceToNull = Type.Transform(
  Type.Object({}, { maxProperties: 0, title: 'EmptyObjectCoerceToNull' })
)
  .Decode(() => null)
  .Encode(() => ({}));
var RawNumber = Type.Transform(
  Type.Object(
    {
      raw: Type.Number(),
    },
    {
      title: 'RawNumber',
    }
  )
)
  .Decode((v) => v.raw)
  .Encode((v) => ({ raw: v }));
var TwoNumberRangeString = Type.Transform(
  Type.RegExp(/^(-?\d+(?:\.\d+)?) - (-?\d+(?:\.\d+)?)$/g, {
    title: 'TwoNumberRangeString',
  })
)
  .Decode((value) => {
    const validatedNumbers = value.match(/-?\d+(?:\.\d+)?/g);
    if (!validatedNumbers) {
      throw new Error(`Unable to decode number range from: ${value}`);
    }
    const [low, high] = validatedNumbers.map((number) => parseFloat(number));
    if (isNaN(low) || isNaN(high)) {
      throw new Error(
        `Unable to decode number range from: ${value}. Decoded value for low is: ${low}, decoded value for high is: ${high}`
      );
    }
    return { low, high };
  })
  .Encode(({ low, high }) => `${low} - ${high}`);
var TwoNumberRange = Type.Object(
  {
    low: Type.Number(),
    high: Type.Number(),
  },
  { title: 'TwoNumberRange' }
);
var EpochTimestamp = Type.Transform(Type.Number())
  .Decode((v) => new Date(v * 1e3))
  .Encode((v) => +v / 1e3);
var RawDateObject = Type.Transform(
  Type.Object(
    {
      raw: EpochTimestamp,
    },
    { title: 'RawDateObject' }
  )
)
  .Decode((v) => v.raw)
  .Encode((v) => ({
    raw: value_exports2.Encode(EpochTimestamp, v),
  }));
var ISOStringDate = Type.Transform(
  Type.Union(
    [
      Type.String({ format: 'date' }),
      Type.String({ format: 'year' }),
      Type.String({ format: 'date-time' }),
    ],
    { title: 'ISOStringDate' }
  )
)
  .Decode((v) => new Date(v))
  .Encode((v) => v.toISOString());
var YahooFinanceDate = Type.Union(
  [Type.Date(), EpochTimestamp, RawDateObject, ISOStringDate],
  { title: 'YahooFinanceDate' }
);
var NullableYahooFinanceDate = Type.Union(
  [YahooFinanceDate, Type.Null(), EmptyObjectCoerceToNull],
  {
    title: 'NullableYahooFinanceDate',
  }
);
var YahooNumber = Type.Union([RawNumber, Type.Number()], {
  title: 'YahooNumber',
});
var YahooDateInMs = Type.Transform(Type.Number({ title: 'YahooDateInMs' }))
  .Decode((v) => new Date(v))
  .Encode((v) => +v);
var NullableYahooNumber = Type.Union(
  [RawNumber, EmptyObjectCoerceToNull, Type.Number(), Type.Null()],
  {
    title: 'NullableYahooNumber',
  }
);
var YahooTwoNumberRange = Type.Union([TwoNumberRange, TwoNumberRangeString], {
  title: 'YahooTwoNumberRange',
});

// node_modules/yahoo-finance2/dist/esm/src/modules/chart.js
var ChartMetaTradingPeriod = Type.Object(
  {
    timezone: Type.String(),
    // "EST",
    start: YahooFinanceDate,
    // new Date(1637355600 * 1000),
    end: YahooFinanceDate,
    // new Date(1637370000 * 10000),
    gmtoffset: YahooNumber,
    // -18000
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartMetaTradingPeriod',
  }
);
var ChartMetaTradingPeriods = Type.Object(
  {
    pre: Type.Optional(Type.Array(Type.Array(ChartMetaTradingPeriod))),
    post: Type.Optional(Type.Array(Type.Array(ChartMetaTradingPeriod))),
    regular: Type.Optional(Type.Array(Type.Array(ChartMetaTradingPeriod))),
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartMetaTradingPeriods',
  }
);
var ChartResultArrayQuote = Type.Object(
  {
    date: YahooFinanceDate,
    high: Type.Union([YahooNumber, Type.Null()]),
    low: Type.Union([YahooNumber, Type.Null()]),
    open: Type.Union([YahooNumber, Type.Null()]),
    close: Type.Union([YahooNumber, Type.Null()]),
    volume: Type.Union([YahooNumber, Type.Null()]),
    adjclose: Type.Optional(Type.Union([YahooNumber, Type.Null()])),
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartResultArrayQuote',
  }
);
var ChartEventDividend = Type.Object(
  {
    amount: YahooNumber,
    date: YahooFinanceDate,
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartEventDividend',
  }
);
var ChartEventDividends = Type.Object(
  {},
  {
    additionalProperties: ChartEventDividend,
    title: 'ChartEventDividends',
  }
);
var ChartEventSplit = Type.Object(
  {
    date: YahooFinanceDate,
    // new Date(1598880600 * 1000)
    numerator: YahooNumber,
    // 4
    denominator: YahooNumber,
    // 1
    splitRatio: Type.String(),
    // "4:1"
  },
  {
    additionalProperties: Type.Any(),
  }
);
var ChartEventsArray = Type.Object(
  {
    dividends: Type.Optional(Type.Array(ChartEventDividend)),
    splits: Type.Optional(Type.Array(ChartEventSplit)),
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartEventsArray',
  }
);
var ChartMeta = Type.Object(
  {
    currency: Type.String(),
    // "USD"
    symbol: Type.String(),
    // "AAPL",
    exchangeName: Type.String(),
    // "NMS",
    instrumentType: Type.String(),
    // "EQUITY",
    firstTradeDate: Type.Union([YahooFinanceDate, Type.Null()]),
    // new Date(345479400 * 1000); null in e.g. "APS.AX"
    regularMarketTime: YahooFinanceDate,
    // new Date(1637355602 * 1000),
    gmtoffset: YahooNumber,
    // -18000,
    timezone: Type.String(),
    /// "EST",
    exchangeTimezoneName: Type.String(),
    // "America/New_York",
    regularMarketPrice: YahooNumber,
    // 160.55,
    chartPreviousClose: Type.Optional(YahooNumber),
    // 79.75; missing in e.g. "APS.AX"
    previousClose: Type.Optional(YahooNumber),
    // 1137.06
    scale: Type.Optional(YahooNumber),
    // 3,
    priceHint: YahooNumber,
    // 2,
    currentTradingPeriod: Type.Object(
      {
        pre: ChartMetaTradingPeriod,
        regular: ChartMetaTradingPeriod,
        post: ChartMetaTradingPeriod,
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
    tradingPeriods: Type.Optional(
      // TODO, would be great to use correct type as a generic based on
      // `includePrePost` and `interval`, see #812.
      Type.Union([
        ChartMetaTradingPeriods,
        Type.Array(Type.Array(ChartMetaTradingPeriod)),
      ])
    ),
    dataGranularity: Type.String(),
    // "1d",
    range: Type.String(),
    // ""
    validRanges: Type.Array(Type.String()),
    // ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartMeta',
  }
);
var ChartResultArraySchema = Type.Object(
  {
    meta: ChartMeta,
    events: Type.Optional(ChartEventsArray),
    quotes: Type.Array(ChartResultArrayQuote),
  },
  { title: 'ChartResultArray' }
);
var ChartEventSplits = Type.Object(
  {},
  {
    additionalProperties: ChartEventSplit,
    title: 'ChartEventSplits',
  }
);
var ChartIndicatorQuote = Type.Object(
  {
    high: Type.Array(Type.Union([YahooNumber, Type.Null()])),
    low: Type.Array(Type.Union([YahooNumber, Type.Null()])),
    open: Type.Array(Type.Union([YahooNumber, Type.Null()])),
    close: Type.Array(Type.Union([YahooNumber, Type.Null()])),
    volume: Type.Array(Type.Union([YahooNumber, Type.Null()])),
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartIndicatorQuote',
  }
);
var ChartIndicatorAdjclose = Type.Object(
  {
    adjclose: Type.Optional(Type.Array(Type.Union([YahooNumber, Type.Null()]))),
    // Missing in e.g. "APS.AX"
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartIndicatorAdjClose',
  }
);
var ChartEventsObject = Type.Object(
  {
    dividends: Type.Optional(ChartEventDividends),
    splits: Type.Optional(ChartEventSplits),
  },
  {
    additionalProperties: Type.Any(),
  }
);
var ChartIndicatorsObject = Type.Object(
  {
    quote: Type.Array(ChartIndicatorQuote),
    adjclose: Type.Optional(Type.Array(ChartIndicatorAdjclose)),
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartIndicatorObject',
  }
);
var ChartResultObjectSchema = Type.Object(
  {
    meta: ChartMeta,
    timestamp: Type.Optional(Type.Array(YahooNumber)),
    events: Type.Optional(ChartEventsObject),
    indicators: ChartIndicatorsObject,
  },
  {
    additionalProperties: Type.Any(),
    title: 'ChartResultObject',
  }
);
var ChartOptionsSchema = Type.Object(
  {
    period1: Type.Union([Type.Date(), Type.String(), YahooNumber]),
    period2: Type.Optional(
      Type.Union([Type.Date(), Type.String(), YahooNumber])
    ),
    useYfid: Type.Optional(Type.Boolean()),
    // true
    interval: Type.Optional(
      Type.Union([
        Type.Literal('1m'),
        Type.Literal('2m'),
        Type.Literal('5m'),
        Type.Literal('15m'),
        Type.Literal('30m'),
        Type.Literal('60m'),
        Type.Literal('90m'),
        Type.Literal('1h'),
        Type.Literal('1d'),
        Type.Literal('5d'),
        Type.Literal('1wk'),
        Type.Literal('1mo'),
        Type.Literal('3mo'),
      ])
    ),
    includePrePost: Type.Optional(Type.Boolean()),
    // true
    events: Type.Optional(Type.String()),
    // 'history',
    lang: Type.Optional(Type.String()),
    // "en-US"
    return: Type.Optional(
      Type.Union([Type.Literal('array'), Type.Literal('object')])
    ),
  },
  {
    title: 'ChartOptions',
  }
);
var ChartOptionsWithReturnArraySchema = Type.Composite(
  [
    ChartOptionsSchema,
    Type.Object({
      return: Type.Optional(Type.Literal('array')),
    }),
  ],
  {
    title: 'ChartOptionsWithReturnArray',
  }
);
var ChartOptionsWithReturnObjectSchema = Type.Composite(
  [
    ChartOptionsSchema,
    Type.Object({
      return: Type.Literal('object'),
    }),
  ],
  {
    title: 'ChartOptionsWithReturnObject',
  }
);
var queryOptionsDefaults = {
  useYfid: true,
  interval: '1d',
  includePrePost: true,
  events: 'div|split|earn',
  lang: 'en-US',
  return: 'array',
};
var _chart = chart;
async function chart(symbol, queryOptionsOverrides, moduleOptions) {
  var _a, _b, _c;
  const returnAs =
    (queryOptionsOverrides === null || queryOptionsOverrides === void 0
      ? void 0
      : queryOptionsOverrides.return) || 'array';
  const result = await this._moduleExec({
    moduleName: 'chart',
    query: {
      assertSymbol: symbol,
      url: 'https://${YF_QUERY_HOST}/v8/finance/chart/' + symbol,
      schema: ChartOptionsSchema,
      defaults: queryOptionsDefaults,
      overrides: queryOptionsOverrides,
      transformWith(queryOptions) {
        if (!queryOptions.period2)
          queryOptions.period2 = /* @__PURE__ */ new Date();
        const dates = ['period1', 'period2'];
        for (const fieldName of dates) {
          const value = queryOptions[fieldName];
          if (value instanceof Date) {
            queryOptions[fieldName] = Math.floor(value.getTime() / 1e3);
          } else if (typeof value === 'string') {
            const timestamp = new Date(value).getTime();
            if (isNaN(timestamp))
              throw new Error(
                "yahooFinance.chart() option '" +
                  fieldName +
                  "' invalid date provided: '" +
                  value +
                  "'"
              );
            queryOptions[fieldName] = Math.floor(timestamp / 1e3);
          }
        }
        if (queryOptions.period1 === queryOptions.period2) {
          throw new Error(
            'yahooFinance.chart() options `period1` and `period2` cannot share the same value.'
          );
        }
        delete queryOptions.return;
        return queryOptions;
      },
    },
    result: {
      schema: ChartResultObjectSchema,
      transformWith(result2) {
        if (!result2.chart)
          throw new Error('Unexpected result: ' + JSON.stringify(result2));
        const chart2 = result2.chart.result[0];
        if (!chart2.timestamp) {
          if (chart2.indicators.quote.length !== 1)
            throw new Error(
              'No timestamp with quotes.length !== 1, please report with your query'
            );
          if (Object.keys(chart2.indicators.quote[0]).length !== 0)
            throw new Error(
              'No timestamp with unexpected quote, please report with your query' +
                JSON.stringify(chart2.indicators.quote[0])
            );
          chart2.indicators.quote.pop();
        }
        return chart2;
      },
    },
    moduleOptions,
  });
  if (returnAs === 'object') {
    return result;
  } else if (returnAs === 'array') {
    const timestamp = result.timestamp;
    if (
      timestamp &&
      ((_a =
        result === null || result === void 0 ? void 0 : result.indicators) ===
        null || _a === void 0
        ? void 0
        : _a.quote) &&
      result.indicators.quote[0].high.length !== timestamp.length
    ) {
      console.log({
        origTimestampSize: result.timestamp && result.timestamp.length,
        filteredSize: timestamp.length,
        quoteSize: result.indicators.quote[0].high.length,
      });
      throw new Error(
        'Timestamp count mismatch, please report this with the query you used'
      );
    }
    const result2 = {
      meta: result.meta,
      quotes: timestamp ? new Array(timestamp.length) : [],
    };
    const adjclose =
      (_c =
        (_b =
          result === null || result === void 0 ? void 0 : result.indicators) ===
          null || _b === void 0
          ? void 0
          : _b.adjclose) === null || _c === void 0
        ? void 0
        : _c[0].adjclose;
    if (timestamp)
      for (let i = 0; i < timestamp.length; i++) {
        result2.quotes[i] = {
          date: new Date(timestamp[i] * 1e3),
          high: result.indicators.quote[0].high[i],
          volume: result.indicators.quote[0].volume[i],
          open: result.indicators.quote[0].open[i],
          low: result.indicators.quote[0].low[i],
          close: result.indicators.quote[0].close[i],
        };
        if (adjclose) result2.quotes[i].adjclose = adjclose[i];
      }
    if (result.events) {
      result2.events = {};
      for (const event of ['dividends', 'splits']) {
        if (result.events[event])
          result2.events[event] = Object.values(result.events[event]);
      }
    }
    return result2;
  }
}
__name(chart, 'chart');

// node_modules/yahoo-finance2/dist/esm/src/modules/historical.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var HistoricalRowHistorySchema = Type.Object(
  {
    date: YahooFinanceDate,
    open: YahooNumber,
    high: YahooNumber,
    low: YahooNumber,
    close: YahooNumber,
    adjClose: Type.Optional(YahooNumber),
    volume: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'HistoricalRowHistory',
  }
);
var HistoricalRowDividendSchema = Type.Object(
  {
    date: YahooFinanceDate,
    dividends: YahooNumber,
  },
  { title: 'HistoricalRowDividend' }
);
var HistoricalRowStockSplitSchema = Type.Object(
  {
    date: YahooFinanceDate,
    stockSplits: Type.String(),
  },
  { title: 'HistoricalRowStockSplit' }
);
var HistoricalOptionsSchema = Type.Object(
  {
    period1: Type.Union([Type.Date(), Type.String(), Type.Number()]),
    period2: Type.Optional(
      Type.Union([Type.Date(), Type.String(), Type.Number()])
    ),
    interval: Type.Optional(
      Type.Union([Type.Literal('1d'), Type.Literal('1wk'), Type.Literal('1mo')])
    ),
    // events: Type.Optional(Type.String()),
    events: Type.Optional(
      Type.Union([
        Type.Literal('history'),
        Type.Literal('dividends'),
        Type.Literal('split'),
      ])
    ),
    includeAdjustedClose: Type.Optional(Type.Boolean()),
  },
  { title: 'HistoricalOptions' }
);
var HistoricalOptionsEventsHistorySchema = Type.Composite(
  [
    HistoricalOptionsSchema,
    Type.Object({
      events: Type.Optional(Type.Literal('history')),
    }),
  ],
  { title: 'HistoricalOptionsEventsHistory' }
);
var HistoricalOptionsEventsDividendsSchema = Type.Composite(
  [
    HistoricalOptionsSchema,
    Type.Object({
      events: Type.Literal('dividends'),
    }),
  ],
  { title: 'HistoricalOptionsEventsDividends' }
);
var HistoricalOptionsEventsSplitSchema = Type.Composite(
  [
    HistoricalOptionsSchema,
    Type.Object({
      events: Type.Literal('split'),
    }),
  ],
  { title: 'HistoricalOptionsEventsSplit' }
);
var HistoricalHistoryResultSchema = Type.Array(HistoricalRowHistorySchema, {
  title: 'HistoricalHistoryResult',
});
var HistoricalDividendsResultSchema = Type.Array(HistoricalRowDividendSchema, {
  title: 'HistoricalDividendsResult',
});
var HistoricalStockSplitsResultSchema = Type.Array(
  HistoricalRowStockSplitSchema,
  {
    title: 'HistoricalRowStockSplit',
  }
);
var queryOptionsDefaults2 = {
  interval: '1d',
  events: 'history',
  includeAdjustedClose: true,
};
function nullFieldCount(object) {
  if (object == null) {
    return;
  }
  let nullCount = 0;
  for (const val of Object.values(object)) if (val === null) nullCount++;
  return nullCount;
}
__name(nullFieldCount, 'nullFieldCount');
async function historical(symbol, queryOptionsOverrides, moduleOptions) {
  var _a, _b, _c, _d, _e;
  showNotice('ripHistorical');
  validateAndCoerceTypes_default({
    type: 'options',
    data:
      queryOptionsOverrides !== null && queryOptionsOverrides !== void 0
        ? queryOptionsOverrides
        : {},
    schema: HistoricalOptionsSchema,
    options: this._opts.validation,
  });
  let schema;
  if (
    !queryOptionsOverrides.events ||
    queryOptionsOverrides.events === 'history'
  )
    schema = HistoricalHistoryResultSchema;
  else if (queryOptionsOverrides.events === 'dividends')
    schema = HistoricalDividendsResultSchema;
  else if (queryOptionsOverrides.events === 'split')
    schema = HistoricalStockSplitsResultSchema;
  else throw new Error('No such event type:' + queryOptionsOverrides.events);
  const queryOpts = { ...queryOptionsDefaults2, ...queryOptionsOverrides };
  if (!value_exports2.Check(HistoricalOptionsSchema, queryOpts))
    throw new Error(
      'Internal error, please report.  Overrides validated but not defaults?'
    );
  const eventsMap = { history: '', dividends: 'div', split: 'split' };
  const chartQueryOpts = {
    period1: queryOpts.period1,
    period2: queryOpts.period2,
    interval: queryOpts.interval,
    events: eventsMap[queryOpts.events || 'history'],
  };
  if (!value_exports2.Check(ChartOptionsSchema, chartQueryOpts))
    throw new Error(
      'Internal error, please report.  historical() provided invalid chart() query options.'
    );
  if (queryOpts.includeAdjustedClose === false) {
  }
  const result = await this.chart(symbol, chartQueryOpts, {
    ...moduleOptions,
    validateResult: true,
  });
  let out;
  if (queryOpts.events === 'dividends') {
    out = (
      (_b =
        (_a = result.events) === null || _a === void 0
          ? void 0
          : _a.dividends) !== null && _b !== void 0
        ? _b
        : []
    ).map((d) => ({
      date: d.date,
      dividends: d.amount,
    }));
  } else if (queryOpts.events === 'split') {
    out = (
      (_d =
        (_c = result.events) === null || _c === void 0 ? void 0 : _c.splits) !==
        null && _d !== void 0
        ? _d
        : []
    ).map((s) => ({
      date: s.date,
      stockSplits: s.splitRatio,
    }));
  } else {
    out = ((_e = result.quotes) !== null && _e !== void 0 ? _e : [])
      .filter((quote2) => {
        const fieldCount = Object.keys(quote2).length;
        const nullCount = nullFieldCount(quote2);
        if (nullCount === 0) {
          return true;
        } else if (nullCount !== fieldCount - 1) {
          console.error(nullCount, quote2);
          throw new Error(
            'Historical returned a result with SOME (but not all) null values.  Please report this, and provide the query that caused it.'
          );
        } else {
          return false;
        }
      })
      .map((quote2) => {
        if (!quote2.adjclose) return quote2;
        const { adjclose, ...rest } = quote2;
        return { ...rest, adjClose: adjclose };
      });
  }
  const validateResult =
    !moduleOptions ||
    moduleOptions.validateResult === void 0 ||
    moduleOptions.validateResult === true;
  const validationOpts = {
    ...this._opts.validation,
    // Set logErrors=false if validateResult=false
    logErrors: validateResult ? this._opts.validation.logErrors : false,
  };
  try {
    return validateAndCoerceTypes_default({
      type: 'result',
      data: out,
      schema,
      options: validationOpts,
    });
  } catch (error3) {
    if (validateResult) throw error3;
  }
  return out;
}
__name(historical, 'historical');

// node_modules/yahoo-finance2/dist/esm/src/modules/insights.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var InsightsDirection = Type.Union(
  [Type.Literal('Bearish'), Type.Literal('Bullish'), Type.Literal('Neutral')],
  { title: 'InsightsDirection' }
);
var InsightsOutlookSchema = Type.Object(
  {
    stateDescription: Type.String(),
    direction: InsightsDirection,
    score: YahooNumber,
    scoreDescription: Type.String(),
    sectorDirection: Type.Optional(InsightsDirection),
    sectorScore: Type.Optional(YahooNumber),
    sectorScoreDescription: Type.Optional(Type.String()),
    indexDirection: InsightsDirection,
    indexScore: YahooNumber,
    indexScoreDescription: Type.String(),
  },
  {
    additionalProperties: Type.Any(),
    title: 'InsightsOutlook',
  }
);
var InsightsInstrumentInfo = Type.Object(
  {
    keyTechnicals: Type.Object(
      {
        provider: Type.String(),
        support: Type.Optional(YahooNumber),
        resistance: Type.Optional(YahooNumber),
        stopLoss: Type.Optional(YahooNumber),
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
    technicalEvents: Type.Object(
      {
        provider: Type.String(),
        sector: Type.Optional(Type.String()),
        shortTermOutlook: InsightsOutlookSchema,
        intermediateTermOutlook: InsightsOutlookSchema,
        longTermOutlook: InsightsOutlookSchema,
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
    valuation: Type.Object(
      {
        color: Type.Optional(YahooNumber),
        description: Type.Optional(Type.String()),
        discount: Type.Optional(Type.String()),
        provider: Type.String(),
        relativeValue: Type.Optional(Type.String()),
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
  },
  {
    additionalProperties: Type.Any(),
    title: 'InsightsInstrumentInfo',
  }
);
var InsightsCompanySnapshot = Type.Object(
  {
    sectorInfo: Type.Optional(Type.String()),
    company: Type.Object(
      {
        innovativeness: Type.Optional(YahooNumber),
        hiring: Type.Optional(YahooNumber),
        sustainability: Type.Optional(YahooNumber),
        insiderSentiments: Type.Optional(YahooNumber),
        earningsReports: Type.Optional(YahooNumber),
        dividends: Type.Optional(YahooNumber),
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
    sector: Type.Object(
      {
        innovativeness: YahooNumber,
        hiring: YahooNumber,
        sustainability: Type.Optional(YahooNumber),
        insiderSentiments: YahooNumber,
        earningsReports: Type.Optional(YahooNumber),
        dividends: YahooNumber,
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
  },
  { title: 'InsightsCompanySnapshot', additionalProperties: Type.Any() }
);
var InsightsEventSchema = Type.Object(
  {
    eventType: Type.String(),
    pricePeriod: Type.String(),
    tradingHorizon: Type.String(),
    tradeType: Type.String(),
    imageUrl: Type.String(),
    startDate: YahooFinanceDate,
    endDate: YahooFinanceDate,
  },
  { title: 'InsightsEvent', additionalProperties: Type.Any() }
);
var InsightsReport = Type.Object(
  {
    id: Type.String(),
    headHtml: Type.String(),
    provider: Type.String(),
    reportDate: YahooFinanceDate,
    reportTitle: Type.String(),
    reportType: Type.String(),
    targetPrice: Type.Optional(YahooNumber),
    targetPriceStatus: Type.Optional(
      Type.Union([
        Type.Literal('Increased'),
        Type.Literal('Maintained'),
        Type.Literal('Decreased'),
        Type.Literal('-'),
      ])
    ),
    investmentRating: Type.Optional(
      Type.Union([
        Type.Literal('Bullish'),
        Type.Literal('Neutral'),
        Type.Literal('Bearish'),
      ])
    ),
    tickers: Type.Optional(Type.Array(Type.String())),
  },
  { title: 'InsightsReport', additionalProperties: Type.Any() }
);
var InsightsSigDev = Type.Object(
  {
    headline: Type.String(),
    date: YahooFinanceDate,
  },
  { title: 'InsightsSigDev', additionalProperties: Type.Any() }
);
var InsightsUpsell = Type.Object(
  {
    msBullishSummary: Type.Optional(Type.Array(Type.String())),
    msBearishSummary: Type.Optional(Type.Array(Type.String())),
    msBullishBearishSummariesPublishDate: Type.Optional(YahooDateInMs),
    companyName: Type.Optional(Type.String()),
    upsellReportType: Type.Optional(Type.String()),
  },
  { title: 'InsightsUpsell', additionalProperties: Type.Any() }
);
var InsightsResearchReport = Type.Object(
  {
    reportId: Type.String(),
    provider: Type.String(),
    title: Type.String(),
    reportDate: YahooFinanceDate,
    summary: Type.String(),
    investmentRating: Type.Optional(
      Type.Union([
        Type.Literal('Bullish'),
        Type.Literal('Neutral'),
        Type.Literal('Bearish'),
      ])
    ),
  },
  { title: 'InsightsResearchReport' }
);
var InsightsSecReport = Type.Object(
  {
    id: Type.String(),
    type: Type.String(),
    title: Type.String(),
    description: Type.String(),
    filingDate: YahooDateInMs,
    snapshotUrl: Type.String(),
    formType: Type.String(),
  },
  {
    title: 'InsightsSecReport',
    additionalProperties: Type.Any(),
  }
);
var InsightsResultSchema = Type.Object(
  {
    symbol: Type.String(),
    instrumentInfo: Type.Optional(InsightsInstrumentInfo),
    companySnapshot: Type.Optional(InsightsCompanySnapshot),
    recommendation: Type.Optional(
      Type.Object({
        targetPrice: Type.Optional(YahooNumber),
        provider: Type.String(),
        rating: Type.Union([
          Type.Literal('BUY'),
          Type.Literal('SELL'),
          Type.Literal('HOLD'),
        ]),
      })
    ),
    events: Type.Optional(Type.Array(InsightsEventSchema)),
    reports: Type.Optional(Type.Array(InsightsReport)),
    sigDevs: Type.Optional(Type.Array(InsightsSigDev)),
    upsell: Type.Optional(InsightsUpsell),
    upsellSearchDD: Type.Optional(
      Type.Object({
        researchReports: InsightsResearchReport,
      })
    ),
    secReports: Type.Optional(Type.Array(InsightsSecReport)),
  },
  {
    additionalProperties: Type.Any(),
    title: 'InsightsResult',
  }
);
var InsightsOptionsSchema = Type.Object(
  {
    lang: Type.Optional(Type.String()),
    region: Type.Optional(Type.String()),
    reportsCount: Type.Optional(YahooNumber),
  },
  { title: 'InsightsOptions' }
);
var queryOptionsDefaults3 = {
  lang: 'en-US',
  region: 'US',
  getAllResearchReports: true,
  reportsCount: 2,
};
function trendingSymbols(symbol, queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'insights',
    query: {
      assertSymbol: symbol,
      url: 'https://${YF_QUERY_HOST}/ws/insights/v2/finance/insights',
      schema: InsightsOptionsSchema,
      defaults: queryOptionsDefaults3,
      overrides: queryOptionsOverrides,
      runtime: { symbol },
    },
    result: {
      schema: InsightsResultSchema,
      transformWith(result) {
        if (!result.finance)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.finance.result;
      },
    },
    moduleOptions,
  });
}
__name(trendingSymbols, 'trendingSymbols');

// node_modules/yahoo-finance2/dist/esm/src/modules/options.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/modules/quote.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var QuoteBase = Type.Object(
  {
    language: Type.String(),
    // "en-US",
    region: Type.String(),
    // "US",
    quoteType: Type.String(),
    // "EQUITY" | "ETF" | "MUTUALFUND";
    typeDisp: Type.Optional(Type.String()),
    // "Equity", not always present.
    quoteSourceName: Type.Optional(Type.String()),
    // "Delayed Quote",
    triggerable: Type.Boolean(),
    // true,
    currency: Type.Optional(Type.String()),
    // "USD",
    // Seems to appear / disappear based not on symbol but network load (#445)
    customPriceAlertConfidence: Type.Optional(Type.String()),
    // "HIGH" | "LOW"; TODO: anything else?
    marketState: Type.Union([
      Type.Literal('REGULAR'),
      Type.Literal('CLOSED'),
      Type.Literal('PRE'),
      Type.Literal('PREPRE'),
      Type.Literal('POST'),
      Type.Literal('POSTPOST'),
    ]),
    tradeable: Type.Boolean(),
    // false,
    cryptoTradeable: Type.Optional(Type.Boolean()),
    // false
    exchange: Type.String(),
    // "NMS",
    shortName: Type.Optional(Type.String()),
    // "NVIDIA Corporation",
    longName: Type.Optional(Type.String()),
    // "NVIDIA Corporation",
    messageBoardId: Type.Optional(Type.String()),
    // "finmb_32307",
    exchangeTimezoneName: Type.String(),
    // "America/New_York",
    exchangeTimezoneShortName: Type.String(),
    // "EST",
    gmtOffSetMilliseconds: YahooNumber,
    // -18000000,
    market: Type.String(),
    // "us_market",
    esgPopulated: Type.Boolean(),
    // false,
    fiftyTwoWeekLowChange: Type.Optional(YahooNumber),
    // 362.96002,
    fiftyTwoWeekLowChangePercent: Type.Optional(YahooNumber),
    // 2.0088556,
    fiftyTwoWeekRange: Type.Optional(YahooTwoNumberRange),
    // "180.68 - 589.07" -> { low, high }
    fiftyTwoWeekHighChange: Type.Optional(YahooNumber),
    // -45.429993,
    fiftyTwoWeekHighChangePercent: Type.Optional(YahooNumber),
    // -0.07712155,
    fiftyTwoWeekLow: Type.Optional(YahooNumber),
    // 180.68,
    fiftyTwoWeekHigh: Type.Optional(YahooNumber),
    // 589.07,
    fiftyTwoWeekChangePercent: Type.Optional(YahooNumber),
    // 22.604025
    dividendDate: Type.Optional(YahooFinanceDate),
    // 1609200000,
    // maybe always present on EQUITY?
    earningsTimestamp: Type.Optional(YahooFinanceDate),
    // 1614200400,
    earningsTimestampStart: Type.Optional(YahooFinanceDate),
    // 1614200400,
    earningsTimestampEnd: Type.Optional(YahooFinanceDate),
    // 1614200400,
    trailingAnnualDividendRate: Type.Optional(YahooNumber),
    // 0.64,
    trailingPE: Type.Optional(YahooNumber),
    // 88.873634,
    trailingAnnualDividendYield: Type.Optional(YahooNumber),
    // 0.0011709387,
    epsTrailingTwelveMonths: Type.Optional(YahooNumber),
    // 6.117,
    epsForward: Type.Optional(YahooNumber),
    // 11.68,
    epsCurrentYear: Type.Optional(YahooNumber),
    // 9.72,
    priceEpsCurrentYear: Type.Optional(YahooNumber),
    // 55.930042,
    sharesOutstanding: Type.Optional(YahooNumber),
    // 619000000,
    bookValue: Type.Optional(YahooNumber),
    // 24.772,
    fiftyDayAverage: Type.Optional(YahooNumber),
    // 530.8828,
    fiftyDayAverageChange: Type.Optional(YahooNumber),
    // 12.757202,
    fiftyDayAverageChangePercent: Type.Optional(YahooNumber),
    // 0.024030166,
    twoHundredDayAverage: Type.Optional(YahooNumber),
    // 515.8518,
    twoHundredDayAverageChange: Type.Optional(YahooNumber),
    // 27.788208,
    twoHundredDayAverageChangePercent: Type.Optional(YahooNumber),
    // 0.053868588,
    marketCap: Type.Optional(YahooNumber),
    // 336513171456,
    forwardPE: Type.Optional(YahooNumber),
    // 46.54452,
    priceToBook: Type.Optional(YahooNumber),
    // 21.945745,
    sourceInterval: YahooNumber,
    // 15,
    exchangeDataDelayedBy: YahooNumber,
    // 0,
    firstTradeDateMilliseconds: Type.Optional(YahooDateInMs),
    // 917015400000 -> Date
    priceHint: YahooNumber,
    // 2,
    postMarketChangePercent: Type.Optional(YahooNumber),
    // 0.093813874,
    postMarketTime: Type.Optional(YahooFinanceDate),
    // 1612573179 -> new Date()
    postMarketPrice: Type.Optional(YahooNumber),
    // 544.15,
    postMarketChange: Type.Optional(YahooNumber),
    // 0.51000977,
    regularMarketChange: Type.Optional(YahooNumber),
    // -2.9299927,
    regularMarketChangePercent: Type.Optional(YahooNumber),
    // -0.53606904,
    regularMarketTime: Type.Optional(YahooFinanceDate),
    // 1612558802 -> new Date()
    regularMarketPrice: Type.Optional(YahooNumber),
    // 543.64,
    regularMarketDayHigh: Type.Optional(YahooNumber),
    // 549.19,
    regularMarketDayRange: Type.Optional(YahooTwoNumberRange),
    // "541.867 - 549.19" -> { low, high }
    regularMarketDayLow: Type.Optional(YahooNumber),
    // 541.867,
    regularMarketVolume: Type.Optional(YahooNumber),
    // 4228841,
    regularMarketPreviousClose: Type.Optional(YahooNumber),
    // 546.57,
    preMarketChange: Type.Optional(YahooNumber),
    // -2.9299927,
    preMarketChangePercent: Type.Optional(YahooNumber),
    // -0.53606904,
    preMarketTime: Type.Optional(YahooFinanceDate),
    // 1612558802 -> new Date()
    preMarketPrice: Type.Optional(YahooNumber),
    // 543.64,
    bid: Type.Optional(YahooNumber),
    // 543.84,
    ask: Type.Optional(YahooNumber),
    // 544.15,
    bidSize: Type.Optional(YahooNumber),
    // 18,
    askSize: Type.Optional(YahooNumber),
    // 8,
    fullExchangeName: Type.String(),
    // "NasdaqGS",
    financialCurrency: Type.Optional(Type.String()),
    // "USD",
    regularMarketOpen: Type.Optional(YahooNumber),
    // 549.0,
    averageDailyVolume3Month: Type.Optional(YahooNumber),
    // 7475022,
    averageDailyVolume10Day: Type.Optional(YahooNumber),
    // 5546385,
    displayName: Type.Optional(Type.String()),
    // "NVIDIA",
    symbol: Type.String(),
    // "NVDA"
    underlyingSymbol: Type.Optional(Type.String()),
    // "LD.MI" (for LDO.MI, #363)
    // only on ETF?  not on EQUITY?
    ytdReturn: Type.Optional(YahooNumber),
    // 0.31
    trailingThreeMonthReturns: Type.Optional(YahooNumber),
    // 16.98
    trailingThreeMonthNavReturns: Type.Optional(YahooNumber),
    // 17.08
    ipoExpectedDate: Type.Optional(YahooFinanceDate),
    // "2020-08-13",
    newListingDate: Type.Optional(YahooFinanceDate),
    // "2021-02-16",
    nameChangeDate: Type.Optional(YahooFinanceDate),
    prevName: Type.Optional(Type.String()),
    averageAnalystRating: Type.Optional(Type.String()),
    pageViewGrowthWeekly: Type.Optional(YahooNumber),
    // Since 2021-11-11 (#326)
    openInterest: Type.Optional(YahooNumber),
    // SOHO (#248)
    beta: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
  }
);
var QuoteCryptoCurrency = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('CRYPTOCURRENCY'),
    circulatingSupply: YahooNumber,
    fromCurrency: Type.String(),
    // 'BTC'
    toCurrency: Type.String(),
    // 'USD=X'
    lastMarket: Type.String(),
    // 'CoinMarketCap'
    coinImageUrl: Type.Optional(Type.String()),
    // 'https://s.yimg.com/uc/fin/img/reports-thumbnails/1.png'
    volume24Hr: Type.Optional(YahooNumber),
    // 62631043072
    volumeAllCurrencies: Type.Optional(YahooNumber),
    // 62631043072
    startDate: Type.Optional(YahooFinanceDate),
    // new Date(1367103600 * 1000)
  }),
]);
var QuoteCurrency = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('CURRENCY'),
  }),
]);
var QuoteEtf = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('ETF'),
  }),
]);
var QuoteEquity = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('EQUITY'),
    dividendRate: Type.Optional(Type.Number()),
    dividendYield: Type.Optional(Type.Number()),
  }),
]);
var QuoteFuture = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('FUTURE'),
    headSymbolAsString: Type.String(),
    contractSymbol: Type.Boolean(),
    underlyingExchangeSymbol: Type.String(),
    expireDate: YahooFinanceDate,
    expireIsoDate: YahooFinanceDate,
  }),
]);
var QuoteIndex = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('INDEX'),
  }),
]);
var QuoteOption = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('OPTION'),
    strike: YahooNumber,
    openInterest: YahooNumber,
    expireDate: YahooNumber,
    expireIsoDate: YahooNumber,
    underlyingSymbol: Type.String(),
  }),
]);
var QuoteMutualfund = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('MUTUALFUND'),
  }),
]);
var QuoteSchema = Type.Union([
  QuoteCryptoCurrency,
  QuoteCurrency,
  QuoteEtf,
  QuoteEquity,
  QuoteFuture,
  QuoteIndex,
  QuoteMutualfund,
  QuoteOption,
]);
var QuoteFieldSchema = Type.KeyOf(QuoteSchema);
var ResultType = Type.Union([
  Type.Literal('array'),
  Type.Literal('object'),
  Type.Literal('map'),
]);
var QuoteResponseArraySchema = Type.Array(QuoteSchema);
var QuoteOptionsSchema = Type.Object({
  fields: Type.Optional(Type.Array(QuoteFieldSchema)),
  return: Type.Optional(ResultType),
});
var QuoteOptionsWithReturnArraySchema = Type.Composite([
  QuoteOptionsSchema,
  Type.Object({
    return: Type.Optional(Type.Literal('array')),
  }),
]);
var QuoteOptionsWithReturnMapSchema = Type.Composite([
  QuoteOptionsSchema,
  Type.Object({
    return: Type.Literal('map'),
  }),
]);
var QuoteOptionsWithReturnObjectSchema = Type.Composite([
  QuoteOptionsSchema,
  Type.Object({
    return: Type.Literal('object'),
  }),
]);
var queryOptionsDefaults4 = {};
async function quote(query, queryOptionsOverrides, moduleOptions) {
  const symbols = typeof query === 'string' ? query : query.join(',');
  const returnAs = queryOptionsOverrides && queryOptionsOverrides.return;
  const results = await this._moduleExec({
    moduleName: 'quote',
    query: {
      url: 'https://${YF_QUERY_HOST}/v7/finance/quote',
      needsCrumb: true,
      schema: QuoteOptionsSchema,
      defaults: queryOptionsDefaults4,
      runtime: { symbols },
      overrides: queryOptionsOverrides,
      transformWith(queryOptions) {
        if (queryOptions.fields) queryOptions.fields.join(',');
        delete queryOptions.return;
        return queryOptions;
      },
    },
    result: {
      schema: QuoteResponseArraySchema,
      transformWith(rawResult) {
        var _a;
        let results2 =
          (_a =
            rawResult === null || rawResult === void 0
              ? void 0
              : rawResult.quoteResponse) === null || _a === void 0
            ? void 0
            : _a.result;
        if (!results2 || !Array.isArray(results2))
          throw new Error('Unexpected result: ' + JSON.stringify(rawResult));
        results2 = results2.filter(
          (quote2) =>
            (quote2 === null || quote2 === void 0
              ? void 0
              : quote2.quoteType) !== 'NONE'
        );
        return results2;
      },
    },
    moduleOptions,
  });
  if (returnAs) {
    switch (returnAs) {
      case 'array':
        return results;
      case 'object': {
        const object = {};
        for (const result of results) object[result.symbol] = result;
        return object;
      }
      case 'map': {
        const map3 = /* @__PURE__ */ new Map();
        for (const result of results) map3.set(result.symbol, result);
        return map3;
      }
    }
  } else {
    return typeof query === 'string' ? results[0] : results;
  }
}
__name(quote, 'quote');

// node_modules/yahoo-finance2/dist/esm/src/modules/options.js
var QuoteCryptoCurrencySchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('CRYPTOCURRENCY'),
      circulatingSupply: YahooNumber,
      fromCurrency: Type.String(),
      // 'BTC'
      toCurrency: Type.String(),
      // 'USD=X'
      lastMarket: Type.String(),
      // 'CoinMarketCap'
      coinImageUrl: Type.Optional(Type.String()),
      // 'https://s.yimg.com/uc/fin/img/reports-thumbnails/1.png'
      volume24Hr: Type.Optional(YahooNumber),
      // 62631043072
      volumeAllCurrencies: Type.Optional(YahooNumber),
      // 62631043072
      startDate: Type.Optional(YahooFinanceDate),
      // new Date(1367103600 * 1000)
    }),
  ],
  { title: 'QuoteCryptoCurrency' }
);
var QuoteCurrencySchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('CURRENCY'),
    }),
  ],
  { title: 'QuoteCurrency' }
);
var QuoteEtfSchema = Type.Composite([
  QuoteBase,
  Type.Object({
    quoteType: Type.Literal('ETF'),
  }),
]);
var QuoteEquitySchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('EQUITY'),
      dividendRate: Type.Optional(Type.Number()),
      dividendYield: Type.Optional(Type.Number()),
    }),
  ],
  { title: 'QuoteEquity' }
);
var QuoteFutureSchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('FUTURE'),
      headSymbolAsString: Type.String(),
      contractSymbol: Type.Boolean(),
      underlyingExchangeSymbol: Type.String(),
      expireDate: YahooFinanceDate,
      expireIsoDate: YahooFinanceDate,
    }),
  ],
  {
    title: 'QuoteFuture',
  }
);
var QuoteIndexSchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('INDEX'),
    }),
  ],
  {
    title: 'QuoteIndex',
  }
);
var QuoteOptionSchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('OPTION'),
      strike: YahooNumber,
      openInterest: YahooNumber,
      expireDate: YahooNumber,
      expireIsoDate: YahooNumber,
      underlyingSymbol: Type.String(),
    }),
  ],
  {
    title: 'QuoteOption',
  }
);
var QuoteMutualfundSchema = Type.Composite(
  [
    QuoteBase,
    Type.Object({
      quoteType: Type.Literal('MUTUALFUND'),
    }),
  ],
  {
    title: 'QuoteMutualFund',
  }
);
var QuoteSchema2 = Type.Union(
  [
    QuoteCryptoCurrencySchema,
    QuoteCurrencySchema,
    QuoteEtfSchema,
    QuoteEquitySchema,
    QuoteFutureSchema,
    QuoteIndexSchema,
    QuoteMutualfundSchema,
    QuoteOptionSchema,
  ],
  {
    title: 'Quote',
  }
);
var CallOrPutSchema = Type.Object(
  {
    contractSymbol: Type.String(),
    strike: YahooNumber,
    currency: Type.Optional(Type.String()),
    lastPrice: YahooNumber,
    change: YahooNumber,
    percentChange: Type.Optional(YahooNumber),
    volume: Type.Optional(YahooNumber),
    openInterest: Type.Optional(YahooNumber),
    bid: Type.Optional(YahooNumber),
    ask: Type.Optional(YahooNumber),
    contractSize: Type.Literal('REGULAR'),
    expiration: YahooFinanceDate,
    lastTradeDate: YahooFinanceDate,
    impliedVolatility: YahooNumber,
    inTheMoney: Type.Boolean(),
  },
  {
    additionalProperties: Type.Any(),
    title: 'CallOrPut',
  }
);
var OptionSchema = Type.Object(
  {
    expirationDate: YahooFinanceDate,
    hasMiniOptions: Type.Boolean(),
    calls: Type.Array(CallOrPutSchema),
    puts: Type.Array(CallOrPutSchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'Option',
  }
);
var OptionsResultSchema = Type.Object(
  {
    underlyingSymbol: Type.String(),
    expirationDates: Type.Array(YahooFinanceDate),
    strikes: Type.Array(YahooNumber),
    hasMiniOptions: Type.Boolean(),
    quote: QuoteSchema2,
    options: Type.Array(OptionSchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'OptionsResult',
  }
);
var OptionsOptionsSchema = Type.Object(
  {
    formatted: Type.Optional(Type.Boolean()),
    lang: Type.Optional(Type.String()),
    region: Type.Optional(Type.String()),
    date: Type.Optional(YahooFinanceDate),
  },
  {
    title: 'OptionsOptions',
  }
);
var queryOptionsDefaults5 = {
  formatted: false,
  lang: 'en-US',
  region: 'US',
};
function options2(symbol, queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'options',
    query: {
      assertSymbol: symbol,
      url: 'https://${YF_QUERY_HOST}/v7/finance/options/' + symbol,
      needsCrumb: true,
      schema: OptionsOptionsSchema,
      defaults: queryOptionsDefaults5,
      overrides: queryOptionsOverrides,
      transformWith(queryOptions) {
        const parsed = value_exports2.Decode(
          OptionsOptionsSchema,
          queryOptions
        );
        const transformed = parsed.date
          ? {
              ...parsed,
              date: Math.floor(parsed.date.getTime() / 1e3),
            }
          : parsed;
        return transformed;
      },
    },
    result: {
      schema: OptionsResultSchema,
      transformWith(result) {
        if (!result.optionChain)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.optionChain.result[0];
      },
    },
    moduleOptions,
  });
}
__name(options2, 'options');

// node_modules/yahoo-finance2/dist/esm/src/modules/quoteSummary.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/modules/quoteSummary-iface.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var EnumGrade;
(function (EnumGrade2) {
  EnumGrade2['Accumulate'] = 'Accumulate';
  EnumGrade2['Add'] = 'Add';
  EnumGrade2['Average'] = 'Average';
  EnumGrade2['BelowAverage'] = 'Below Average';
  EnumGrade2['Buy'] = 'Buy';
  EnumGrade2['ConvictionBuy'] = 'Conviction Buy';
  EnumGrade2['Empty'] = '';
  EnumGrade2['EqualWeight'] = 'Equal-Weight';
  EnumGrade2['FairValue'] = 'Fair Value';
  EnumGrade2['GradeEqualWeight'] = 'Equal-weight';
  EnumGrade2['GradeLongTermBuy'] = 'Long-term Buy';
  EnumGrade2['Hold'] = 'Hold';
  EnumGrade2['LongTermBuy'] = 'Long-Term Buy';
  EnumGrade2['MarketOutperform'] = 'Market Outperform';
  EnumGrade2['MarketPerform'] = 'Market Perform';
  EnumGrade2['Mixed'] = 'Mixed';
  EnumGrade2['Negative'] = 'Negative';
  EnumGrade2['Neutral'] = 'Neutral';
  EnumGrade2['InLine'] = 'In-Line';
  EnumGrade2['Outperform'] = 'Outperform';
  EnumGrade2['Overweight'] = 'Overweight';
  EnumGrade2['PeerPerform'] = 'Peer Perform';
  EnumGrade2['Perform'] = 'Perform';
  EnumGrade2['Positive'] = 'Positive';
  EnumGrade2['Reduce'] = 'Reduce';
  EnumGrade2['SectorOutperform'] = 'Sector Outperform';
  EnumGrade2['SectorPerform'] = 'Sector Perform';
  EnumGrade2['SectorWeight'] = 'Sector Weight';
  EnumGrade2['Sell'] = 'Sell';
  EnumGrade2['StrongBuy'] = 'Strong Buy';
  EnumGrade2['TopPick'] = 'Top Pick';
  EnumGrade2['Underperform'] = 'Underperform';
  EnumGrade2['Underperformer'] = 'Underperformer';
  EnumGrade2['Underweight'] = 'Underweight';
  EnumGrade2['Trim'] = 'Trim';
  EnumGrade2['AboveAverage'] = 'Above Average';
  EnumGrade2['Inline'] = 'In-line';
  EnumGrade2['Outperformer'] = 'Outperformer';
  EnumGrade2['OVerweight'] = 'OVerweight';
  EnumGrade2['Cautious'] = 'Cautious';
  EnumGrade2['MarketWeight'] = 'Market Weight';
  EnumGrade2['SectorUnderperform'] = 'Sector Underperform';
  EnumGrade2['MarketUnderperform'] = 'Market Underperform';
  EnumGrade2['Peerperform'] = 'Peer perform';
  EnumGrade2['GraduallyAccumulate'] = 'Gradually Accumulate';
  EnumGrade2['ActionListBuy'] = 'Action List Buy';
  EnumGrade2['Performer'] = 'Performer';
  EnumGrade2['SectorPerformer'] = 'Sector Performer';
  EnumGrade2['SpeculativeBuy'] = 'Speculative Buy';
  EnumGrade2['StrongSell'] = 'Strong Sell';
  EnumGrade2['SpeculativeHold'] = 'Speculative Hold';
  EnumGrade2['NotRated'] = 'Not Rated';
  EnumGrade2['HoldNeutral'] = 'Hold Neutral';
  EnumGrade2['Developing'] = 'Developing';
  EnumGrade2['buy'] = 'buy';
  EnumGrade2['HOld'] = 'HOld';
  EnumGrade2['TradingSell'] = 'Trading Sell';
  EnumGrade2['Tender'] = 'Tender';
  EnumGrade2['marketperform'] = 'market perform';
  EnumGrade2['BUy'] = 'BUy';
})(EnumGrade || (EnumGrade = {}));
var Action;
(function (Action2) {
  Action2['Down'] = 'down';
  Action2['Init'] = 'init';
  Action2['Main'] = 'main';
  Action2['Reit'] = 'reit';
  Action2['Up'] = 'up';
})(Action || (Action = {}));
var Grade = Type.Enum(EnumGrade, { title: 'QuoteSummaryEnumGrade' });
var ActionSchema = Type.Enum(Action, { title: 'QuoteSummaryAction' });
var UpgradeDowngradeHistoryHistorySchema = Type.Object(
  {
    epochGradeDate: YahooFinanceDate,
    firm: Type.String(),
    toGrade: Grade,
    fromGrade: Type.Optional(Grade),
    action: ActionSchema,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryUpgradeDowngradeHistoryHistory',
  }
);
var UpgradeDowngradeHistorySchema = Type.Object(
  {
    history: Type.Array(UpgradeDowngradeHistoryHistorySchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryUpgradeDowngradeHistory',
  }
);
var TopHoldingsSectorWeightingSchema = Type.Object(
  {
    realestate: Type.Optional(YahooNumber),
    consumer_cyclical: Type.Optional(YahooNumber),
    basic_materials: Type.Optional(YahooNumber),
    consumer_defensive: Type.Optional(YahooNumber),
    technology: Type.Optional(YahooNumber),
    communication_services: Type.Optional(YahooNumber),
    financial_services: Type.Optional(YahooNumber),
    utilities: Type.Optional(YahooNumber),
    industrials: Type.Optional(YahooNumber),
    energy: Type.Optional(YahooNumber),
    healthcare: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTopHoldingsSectorWeighting',
  }
);
var TopHoldingsBondRatingSchema = Type.Object(
  {
    a: Type.Optional(YahooNumber),
    aa: Type.Optional(YahooNumber),
    aaa: Type.Optional(YahooNumber),
    other: Type.Optional(YahooNumber),
    b: Type.Optional(YahooNumber),
    bb: Type.Optional(YahooNumber),
    bbb: Type.Optional(YahooNumber),
    below_b: Type.Optional(YahooNumber),
    us_government: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTopHoldingsBondRating',
  }
);
var TopHoldingsEquityHoldingsSchema = Type.Object(
  {
    medianMarketCap: Type.Optional(YahooNumber),
    medianMarketCapCat: Type.Optional(YahooNumber),
    priceToBook: YahooNumber,
    priceToBookCat: Type.Optional(YahooNumber),
    priceToCashflow: YahooNumber,
    priceToCashflowCat: Type.Optional(YahooNumber),
    priceToEarnings: YahooNumber,
    priceToEarningsCat: Type.Optional(YahooNumber),
    priceToSales: YahooNumber,
    priceToSalesCat: Type.Optional(YahooNumber),
    threeYearEarningsGrowth: Type.Optional(YahooNumber),
    threeYearEarningsGrowthCat: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTopHoldingsEquityHoldings',
  }
);
var TopHoldingsHoldingSchema = Type.Object(
  {
    symbol: Type.String(),
    holdingName: Type.String(),
    holdingPercent: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTopHoldingsHolding',
  }
);
var TopHoldingsSchema = Type.Object(
  {
    maxAge: YahooNumber,
    stockPosition: Type.Optional(YahooNumber),
    bondPosition: Type.Optional(YahooNumber),
    holdings: Type.Array(TopHoldingsHoldingSchema),
    equityHoldings: TopHoldingsEquityHoldingsSchema,
    bondHoldings: Type.Object({}),
    bondRatings: Type.Array(TopHoldingsBondRatingSchema),
    sectorWeightings: Type.Array(TopHoldingsSectorWeightingSchema),
    cashPosition: Type.Optional(YahooNumber),
    otherPosition: Type.Optional(YahooNumber),
    preferredPosition: Type.Optional(YahooNumber),
    convertiblePosition: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTopHoldings',
  }
);
var SummaryProfileSchema = Type.Object(
  {
    address1: Type.Optional(Type.String()),
    address2: Type.Optional(Type.String()),
    address3: Type.Optional(Type.String()),
    city: Type.Optional(Type.String()),
    state: Type.Optional(Type.String()),
    zip: Type.Optional(Type.String()),
    country: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    fax: Type.Optional(Type.String()),
    website: Type.Optional(Type.String()),
    industry: Type.Optional(Type.String()),
    industryDisp: Type.Optional(Type.String()),
    sector: Type.Optional(Type.String()),
    sectorDisp: Type.Optional(Type.String()),
    longBusinessSummary: Type.Optional(Type.String()),
    fullTimeEmployees: Type.Optional(YahooNumber),
    companyOfficers: Type.Array(Type.Any()),
    maxAge: YahooNumber,
    twitter: Type.Optional(Type.String()),
    // in e.g. "ADA-USD" (#418)
    // seems like for cryptocurency only
    // TODO: how does this relate to Quote type.  Common base?
    name: Type.Optional(Type.String()),
    // 'Bitcoin'
    startDate: Type.Optional(YahooFinanceDate),
    // new Date('2013-04-28')
    description: Type.Optional(Type.String()),
    // 'Bitcoin (BTC) is a cryptocurrency...'
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummarySummaryProfile',
  }
);
var SummaryDetailSchema = Type.Object(
  {
    maxAge: YahooNumber,
    priceHint: YahooNumber,
    previousClose: Type.Optional(YahooNumber),
    // missing in e.g. "APS.AX"
    open: Type.Optional(YahooNumber),
    dayLow: Type.Optional(YahooNumber),
    dayHigh: Type.Optional(YahooNumber),
    regularMarketPreviousClose: Type.Optional(YahooNumber),
    // missing in e.g. "APS.AX"
    regularMarketOpen: Type.Optional(YahooNumber),
    regularMarketDayLow: Type.Optional(YahooNumber),
    regularMarketDayHigh: Type.Optional(YahooNumber),
    regularMarketVolume: Type.Optional(YahooNumber),
    dividendRate: Type.Optional(YahooNumber),
    dividendYield: Type.Optional(YahooNumber),
    exDividendDate: Type.Optional(YahooFinanceDate),
    payoutRatio: Type.Optional(YahooNumber),
    fiveYearAvgDividendYield: Type.Optional(YahooNumber),
    beta: Type.Optional(YahooNumber),
    trailingPE: Type.Optional(YahooNumber),
    forwardPE: Type.Optional(YahooNumber),
    volume: Type.Optional(YahooNumber),
    averageVolume: Type.Optional(YahooNumber),
    averageVolume10days: Type.Optional(YahooNumber),
    averageDailyVolume10Day: Type.Optional(YahooNumber),
    bid: Type.Optional(YahooNumber),
    ask: Type.Optional(YahooNumber),
    bidSize: Type.Optional(YahooNumber),
    askSize: Type.Optional(YahooNumber),
    marketCap: Type.Optional(YahooNumber),
    fiftyDayAverage: Type.Optional(YahooNumber),
    fiftyTwoWeekLow: Type.Optional(YahooNumber),
    fiftyTwoWeekHigh: Type.Optional(YahooNumber),
    twoHundredDayAverage: Type.Optional(YahooNumber),
    priceToSalesTrailing12Months: Type.Optional(YahooNumber),
    trailingAnnualDividendRate: Type.Optional(YahooNumber),
    trailingAnnualDividendYield: Type.Optional(YahooNumber),
    currency: Type.String(),
    algorithm: Type.Null(),
    tradeable: Type.Boolean(),
    yield: Type.Optional(YahooNumber),
    totalAssets: Type.Optional(YahooNumber),
    navPrice: Type.Optional(YahooNumber),
    ytdReturn: Type.Optional(YahooNumber),
    // crypto only (optional, or null in other types)
    // TODO: how does Price / SummaryDetail compare? common base?
    fromCurrency: Type.Union([Type.String(), Type.Null()]),
    // 'BTC'
    toCurrency: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    // 'USD-X'
    lastMarket: Type.Union([Type.String(), Type.Null()]),
    // 'CoinMarketCap'
    volume24Hr: Type.Optional(YahooNumber),
    // 62650314752
    volumeAllCurrencies: Type.Optional(YahooNumber),
    // 62650314752
    circulatingSupply: Type.Optional(YahooNumber),
    // 18638932
    startDate: Type.Optional(YahooFinanceDate),
    // new Date(1367107200 * 1000)
    coinMarketCapLink: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    // "https://coinmarketcap.com/currencies/cardano"
    // futures
    expireDate: Type.Optional(YahooFinanceDate),
    // 1656374400,
    openInterest: Type.Optional(YahooNumber),
    // 444411,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummarySummaryDetail',
  }
);
var FilingType = Type.Union(
  [
    Type.Literal('10-K'),
    Type.Literal('10-Q'),
    Type.Literal('8-K'),
    Type.Literal('8-K/A'),
    Type.Literal('10-K/A'),
    Type.Literal('10-Q/A'),
    Type.Literal('SD'),
    Type.Literal('PX14A6G'),
    Type.Literal('SC 13G/A'),
    Type.Literal('DEFA14A'),
    Type.Literal('25-NSE'),
    Type.Literal('S-8 POS'),
    Type.Literal('6-K'),
    Type.Literal('F-3ASR'),
    Type.Literal('SC 13D/A'),
    Type.Literal('20-F'),
    Type.Literal('425'),
    Type.Literal('SC14D9C'),
    Type.Literal('SC 13G'),
    Type.Literal('S-8'),
    Type.Literal('DEF 14A'),
    Type.Literal('F-10'),
  ],
  {
    title: 'QuoteSummaryFilingType',
  }
);
var FilingSchema = Type.Object(
  {
    date: Type.String(),
    epochDate: YahooFinanceDate,
    type: FilingType,
    title: Type.String(),
    edgarUrl: Type.String(),
    maxAge: YahooNumber,
    url: Type.Optional(Type.String()),
    exhibits: Type.Optional(
      Type.Array(
        Type.Object({
          type: Type.String(),
          url: Type.String(),
          downloadUrl: Type.Optional(Type.String()),
        })
      )
    ),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFiling',
  }
);
var SECFilingsSchema = Type.Object(
  {
    filings: Type.Array(FilingSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummarySECFilings',
  }
);
var RecommendationTrendTrendSchema = Type.Object(
  {
    period: Type.String(),
    strongBuy: YahooNumber,
    buy: YahooNumber,
    hold: YahooNumber,
    sell: YahooNumber,
    strongSell: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryRecommendationTrendTrend',
  }
);
var RecommendationTrendSchema = Type.Object(
  {
    trend: Type.Array(RecommendationTrendTrendSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryRecommendationTrend',
  }
);
var QuoteTypeSchema = Type.Object(
  {
    exchange: Type.String(),
    quoteType: Type.String(),
    symbol: Type.String(),
    underlyingSymbol: Type.String(),
    shortName: Type.Union([Type.Null(), Type.String()]),
    longName: Type.Union([Type.Null(), Type.String()]),
    firstTradeDateEpochUtc: NullableYahooFinanceDate,
    timeZoneFullName: Type.String(),
    timeZoneShortName: Type.String(),
    uuid: Type.String(),
    messageBoardId: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    gmtOffSetMilliseconds: YahooNumber,
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryQuoteType',
  }
);
var PriceSchema = Type.Object(
  {
    averageDailyVolume10Day: Type.Optional(YahooNumber),
    averageDailyVolume3Month: Type.Optional(YahooNumber),
    exchange: Type.Optional(Type.String()),
    exchangeName: Type.Optional(Type.String()),
    exchangeDataDelayedBy: Type.Optional(YahooNumber),
    maxAge: YahooNumber,
    postMarketChangePercent: Type.Optional(YahooNumber),
    postMarketChange: Type.Optional(YahooNumber),
    postMarketTime: Type.Optional(YahooFinanceDate),
    postMarketPrice: Type.Optional(YahooNumber),
    postMarketSource: Type.Optional(Type.String()),
    preMarketChangePercent: Type.Optional(YahooNumber),
    preMarketChange: Type.Optional(YahooNumber),
    preMarketTime: Type.Optional(YahooFinanceDate),
    preMarketPrice: Type.Optional(YahooNumber),
    preMarketSource: Type.Optional(Type.String()),
    priceHint: YahooNumber,
    regularMarketChangePercent: Type.Optional(YahooNumber),
    regularMarketChange: Type.Optional(YahooNumber),
    regularMarketTime: Type.Optional(YahooFinanceDate),
    regularMarketPrice: Type.Optional(YahooNumber),
    regularMarketDayHigh: Type.Optional(YahooNumber),
    regularMarketDayLow: Type.Optional(YahooNumber),
    regularMarketVolume: Type.Optional(YahooNumber),
    regularMarketPreviousClose: Type.Optional(YahooNumber),
    regularMarketSource: Type.Optional(Type.String()),
    regularMarketOpen: Type.Optional(YahooNumber),
    quoteSourceName: Type.Optional(Type.String()),
    quoteType: Type.String(),
    symbol: Type.String(),
    underlyingSymbol: Type.Union([Type.Null(), Type.String()]),
    shortName: Type.Union([Type.Null(), Type.String()]),
    longName: Type.Union([Type.Null(), Type.String()]),
    lastMarket: Type.Union([Type.Null(), Type.String()]),
    marketState: Type.Optional(Type.String()),
    marketCap: Type.Optional(YahooNumber),
    currency: Type.Optional(Type.String()),
    currencySymbol: Type.Optional(Type.String()),
    fromCurrency: Type.Union([Type.String(), Type.Null()]),
    toCurrency: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    volume24Hr: Type.Optional(YahooNumber),
    volumeAllCurrencies: Type.Optional(YahooNumber),
    circulatingSupply: Type.Optional(YahooNumber),
    expireDate: Type.Optional(YahooFinanceDate),
    openInterest: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryPrice',
  }
);
var NetSharePurchaseActivitySchema = Type.Object(
  {
    maxAge: YahooNumber,
    period: Type.String(),
    buyInfoCount: YahooNumber,
    buyInfoShares: YahooNumber,
    buyPercentInsiderShares: Type.Optional(YahooNumber),
    sellInfoCount: YahooNumber,
    sellInfoShares: Type.Optional(YahooNumber),
    sellPercentInsiderShares: Type.Optional(YahooNumber),
    netInfoCount: YahooNumber,
    netInfoShares: YahooNumber,
    netPercentInsiderShares: Type.Optional(YahooNumber),
    totalInsiderShares: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryNetSharePurchaseActivity',
  }
);
var MajorHoldersBreakdownSchema = Type.Object(
  {
    maxAge: YahooNumber,
    insidersPercentHeld: Type.Optional(YahooNumber),
    institutionsPercentHeld: Type.Optional(YahooNumber),
    institutionsFloatPercentHeld: Type.Optional(YahooNumber),
    institutionsCount: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryMajorHoldersBreakdown',
  }
);
var EnumOwnership;
(function (EnumOwnership2) {
  EnumOwnership2['D'] = 'D';
  EnumOwnership2['I'] = 'I';
})(EnumOwnership || (EnumOwnership = {}));
var EnumRelation;
(function (EnumRelation2) {
  EnumRelation2['ChairmanOfTheBoard'] = 'Chairman of the Board';
  EnumRelation2['ChiefExecutiveOfficer'] = 'Chief Executive Officer';
  EnumRelation2['ChiefFinancialOfficer'] = 'Chief Financial Officer';
  EnumRelation2['ChiefOperatingOfficer'] = 'Chief Operating Officer';
  EnumRelation2['ChiefTechnologyOfficer'] = 'Chief Technology Officer';
  EnumRelation2['Director'] = 'Director';
  EnumRelation2['DirectorIndependent'] = 'Director (Independent)';
  EnumRelation2['Empty'] = '';
  EnumRelation2['GeneralCounsel'] = 'General Counsel';
  EnumRelation2['IndependentNonExecutiveDirector'] =
    'Independent Non-Executive Director';
  EnumRelation2['Officer'] = 'Officer';
  EnumRelation2['President'] = 'President';
})(EnumRelation || (EnumRelation = {}));
var Relation = Type.Enum(EnumRelation, { title: 'QuoteSummaryRelation' });
var OwnershipEnumSchema = Type.Enum(EnumOwnership, {
  title: 'QuoteSummaryOwnershipEnum',
});
var TransactionSchema = Type.Object(
  {
    maxAge: YahooNumber,
    shares: YahooNumber,
    filerUrl: Type.String(),
    transactionText: Type.String(),
    filerName: Type.String(),
    filerRelation: Type.Union([Relation, Type.String()]),
    moneyText: Type.String(),
    startDate: YahooFinanceDate,
    ownership: Type.Union([OwnershipEnumSchema, Type.String()]),
    value: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTransaction',
  }
);
var InsiderTransactionsSchema = Type.Object(
  {
    transactions: Type.Array(TransactionSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryInsiderTransactions',
  }
);
var HolderSchema = Type.Object(
  {
    maxAge: YahooNumber,
    name: Type.String(),
    relation: Type.Union([Relation, Type.String()]),
    url: Type.String(),
    transactionDescription: Type.String(),
    latestTransDate: YahooFinanceDate,
    positionDirect: Type.Optional(YahooNumber),
    positionDirectDate: Type.Optional(YahooFinanceDate),
    positionIndirect: Type.Optional(YahooNumber),
    positionIndirectDate: Type.Optional(YahooFinanceDate),
    positionSummaryDate: Type.Optional(YahooFinanceDate),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryHolder',
  }
);
var HoldersSchema = Type.Object(
  {
    holders: Type.Array(HolderSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryHolders',
  }
);
var TrendSchema = Type.Object(
  {
    maxAge: YahooNumber,
    symbol: Type.Null(),
    estimates: Type.Array(Type.Any()),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryTrend',
  }
);
var EstimateSchema = Type.Object(
  {
    period: Type.String(),
    growth: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEstimate',
  }
);
var IndexTrendSchema = Type.Object(
  {
    maxAge: YahooNumber,
    symbol: Type.String(),
    peRatio: YahooNumber,
    pegRatio: YahooNumber,
    estimates: Type.Array(EstimateSchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryIndexTrend',
  }
);
var IncomeStatementHistoryElementSchema = Type.Object(
  {
    maxAge: NullableYahooNumber,
    endDate: YahooFinanceDate,
    totalRevenue: NullableYahooNumber,
    costOfRevenue: NullableYahooNumber,
    grossProfit: NullableYahooNumber,
    researchDevelopment: NullableYahooNumber,
    sellingGeneralAdministrative: NullableYahooNumber,
    nonRecurring: NullableYahooNumber,
    otherOperatingExpenses: NullableYahooNumber,
    totalOperatingExpenses: NullableYahooNumber,
    operatingIncome: NullableYahooNumber,
    totalOtherIncomeExpenseNet: NullableYahooNumber,
    ebit: NullableYahooNumber,
    interestExpense: NullableYahooNumber,
    incomeBeforeTax: NullableYahooNumber,
    incomeTaxExpense: NullableYahooNumber,
    minorityInterest: NullableYahooNumber,
    netIncomeFromContinuingOps: NullableYahooNumber,
    discontinuedOperations: NullableYahooNumber,
    extraordinaryItems: NullableYahooNumber,
    effectOfAccountingCharges: NullableYahooNumber,
    otherItems: NullableYahooNumber,
    netIncome: NullableYahooNumber,
    netIncomeApplicableToCommonShares: NullableYahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryIncomeStatementHistoryElement',
  }
);
var IncomeStatementHistorySchema = Type.Object(
  {
    incomeStatementHistory: Type.Array(IncomeStatementHistoryElementSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryIncomeStatementHistory',
  }
);
var FundProfileBrokerageSchema = Type.Object(
  {},
  {
    title: 'QuoteSummaryFundProfileBrokerage',
  }
);
var FundProfileFeesExpensesInvestmentSchema = Type.Object(
  {
    annualHoldingsTurnover: Type.Optional(YahooNumber),
    annualReportExpenseRatio: Type.Optional(YahooNumber),
    grossExpRatio: Type.Optional(YahooNumber),
    netExpRatio: Type.Optional(YahooNumber),
    projectionValues: Type.Object({}),
    totalNetAssets: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundProfileFeesExpensesInvestment',
  }
);
var FundProfileFeesExpensesInvestmentCatSchema = Type.Composite(
  [
    Type.Omit(FundProfileFeesExpensesInvestmentSchema, ['projectionValues']),
    Type.Object({
      projectionValuesCat: Type.Object({}),
    }),
  ],
  {
    title: 'QuoteSummaryFundProfileFeesExpensesInvestmentCat',
    additionalProperties: Type.Any(),
  }
);
var FundProfileManagementInfoSchema = Type.Object(
  {
    managerName: Type.Union([Type.Null(), Type.String()]),
    managerBio: Type.Union([Type.Null(), Type.String()]),
    startdate: Type.Optional(YahooFinanceDate),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundProfileManagementInfo',
  }
);
var FundProfileSchema = Type.Object(
  {
    maxAge: YahooNumber,
    styleBoxUrl: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    family: Type.Union([Type.Null(), Type.String()]),
    categoryName: Type.Union([Type.Null(), Type.String()]),
    legalType: Type.Union([Type.Null(), Type.String()]),
    managementInfo: Type.Optional(FundProfileManagementInfoSchema),
    feesExpensesInvestment: Type.Optional(
      FundProfileFeesExpensesInvestmentSchema
    ),
    feesExpensesInvestmentCat: Type.Optional(
      FundProfileFeesExpensesInvestmentCatSchema
    ),
    brokerages: Type.Optional(Type.Array(FundProfileBrokerageSchema)),
    initInvestment: Type.Optional(YahooNumber),
    initIraInvestment: Type.Optional(YahooNumber),
    initAipInvestment: Type.Optional(YahooNumber),
    subseqInvestment: Type.Optional(YahooNumber),
    subseqIraInvestment: Type.Optional(YahooNumber),
    subseqAipInvestment: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundProfile',
  }
);
var FundPerformanceRiskOverviewStatsRowSchema = Type.Object(
  {
    year: Type.String(),
    // "5y" | "3y" | "10y" | anything else?
    alpha: YahooNumber,
    // 7.76
    beta: YahooNumber,
    // 1.04
    meanAnnualReturn: YahooNumber,
    // 2.05
    rSquared: YahooNumber,
    // 84.03
    stdDev: Type.Optional(YahooNumber),
    // 17.12
    sharpeRatio: YahooNumber,
    // 1.37
    treynorRatio: YahooNumber,
    // 23.61
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformanceRiskOverviewStatsRow',
  }
);
var FundPerformanceRiskOverviewStatsCatSchema = Type.Object(
  {
    riskStatisticsCat: Type.Array(FundPerformanceRiskOverviewStatsRowSchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformanceRiskOverviewStatsCat',
  }
);
var FundPerformanceRiskOverviewStatsSchema = Type.Object(
  {
    riskStatistics: Type.Array(FundPerformanceRiskOverviewStatsRowSchema),
    riskRating: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformanceRiskOverviewStats',
  }
);
var FundPerformanceReturnsRowSchema = Type.Object(
  {
    year: YahooFinanceDate,
    annualValue: Type.Optional(YahooNumber),
    q1: Type.Optional(YahooNumber),
    q2: Type.Optional(YahooNumber),
    q3: Type.Optional(YahooNumber),
    q4: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformanceReturnsRow',
  }
);
var FundPerformanceReturnsSchema = Type.Object(
  {
    returns: Type.Array(FundPerformanceReturnsRowSchema),
    returnsCat: Type.Optional(Type.Array(FundPerformanceReturnsRowSchema)),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformanceReturns',
  }
);
var FundPerformancePerformanceOverviewCatSchema = Type.Object(
  {
    ytdReturnPct: Type.Optional(YahooNumber),
    fiveYrAvgReturnPct: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformancePerformanceOverviewCat',
  }
);
var FundPerformancePerformanceOverviewSchema = Type.Object(
  {
    asOfDate: Type.Optional(YahooFinanceDate),
    ytdReturnPct: Type.Optional(YahooNumber),
    oneYearTotalReturn: Type.Optional(YahooNumber),
    threeYearTotalReturn: Type.Optional(YahooNumber),
    fiveYrAvgReturnPct: Type.Optional(YahooNumber),
    morningStarReturnRating: Type.Optional(YahooNumber),
    numYearsUp: Type.Optional(YahooNumber),
    numYearsDown: Type.Optional(YahooNumber),
    bestOneYrTotalReturn: Type.Optional(YahooNumber),
    worstOneYrTotalReturn: Type.Optional(YahooNumber),
    bestThreeYrTotalReturn: Type.Optional(YahooNumber),
    worstThreeYrTotalReturn: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformancePerformanceOverview',
  }
);
var PeriodRangeSchema = Type.Object(
  {
    asOfDate: Type.Optional(YahooFinanceDate),
    ytd: Type.Optional(YahooNumber),
    oneMonth: Type.Optional(YahooNumber),
    threeMonth: Type.Optional(YahooNumber),
    oneYear: Type.Optional(YahooNumber),
    threeYear: Type.Optional(YahooNumber),
    fiveYear: Type.Optional(YahooNumber),
    tenYear: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryPeriodRange',
  }
);
var FundPerformanceTrailingReturnsSchema = Type.Composite(
  [
    PeriodRangeSchema,
    Type.Object(
      {
        lastBullMkt: Type.Optional(YahooNumber),
        lastBearMkt: Type.Optional(YahooNumber),
      },
      {
        additionalProperties: Type.Any(),
      }
    ),
  ],
  {
    title: 'QuoteSummaryFundPerformanceTrailingReturns',
  }
);
var FundPerformanceSchema = Type.Object(
  {
    maxAge: YahooNumber,
    loadAdjustedReturns: Type.Optional(PeriodRangeSchema),
    rankInCategory: Type.Optional(PeriodRangeSchema),
    performanceOverview: FundPerformancePerformanceOverviewSchema,
    performanceOverviewCat: FundPerformancePerformanceOverviewCatSchema,
    trailingReturns: FundPerformanceTrailingReturnsSchema,
    trailingReturnsNav: FundPerformanceTrailingReturnsSchema,
    trailingReturnsCat: FundPerformanceTrailingReturnsSchema,
    annualTotalReturns: FundPerformanceReturnsSchema,
    pastQuarterlyReturns: FundPerformanceReturnsSchema,
    riskOverviewStatistics: FundPerformanceRiskOverviewStatsSchema,
    riskOverviewStatisticsCat: FundPerformanceRiskOverviewStatsCatSchema,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFundPerformance',
  }
);
var OwnershipListSchema = Type.Object(
  {
    maxAge: YahooNumber,
    reportDate: YahooFinanceDate,
    organization: Type.String(),
    pctHeld: YahooNumber,
    position: YahooNumber,
    value: YahooNumber,
    pctChange: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryOwnershipList',
  }
);
var OwnershipSchema = Type.Object(
  {
    maxAge: YahooNumber,
    ownershipList: Type.Array(OwnershipListSchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryOwnership',
  }
);
var FinancialDataSchema = Type.Object(
  {
    maxAge: YahooNumber,
    currentPrice: Type.Optional(YahooNumber),
    targetHighPrice: Type.Optional(YahooNumber),
    targetLowPrice: Type.Optional(YahooNumber),
    targetMeanPrice: Type.Optional(YahooNumber),
    targetMedianPrice: Type.Optional(YahooNumber),
    recommendationMean: Type.Optional(YahooNumber),
    recommendationKey: Type.String(),
    numberOfAnalystOpinions: Type.Optional(YahooNumber),
    totalCash: Type.Optional(YahooNumber),
    totalCashPerShare: Type.Optional(YahooNumber),
    ebitda: Type.Optional(YahooNumber),
    totalDebt: Type.Optional(YahooNumber),
    quickRatio: Type.Optional(YahooNumber),
    currentRatio: Type.Optional(YahooNumber),
    totalRevenue: Type.Optional(YahooNumber),
    debtToEquity: Type.Optional(YahooNumber),
    revenuePerShare: Type.Optional(YahooNumber),
    returnOnAssets: Type.Optional(YahooNumber),
    returnOnEquity: Type.Optional(YahooNumber),
    grossProfits: Type.Optional(YahooNumber),
    freeCashflow: Type.Optional(YahooNumber),
    operatingCashflow: Type.Optional(YahooNumber),
    earningsGrowth: Type.Optional(YahooNumber),
    revenueGrowth: Type.Optional(YahooNumber),
    grossMargins: Type.Optional(YahooNumber),
    ebitdaMargins: Type.Optional(YahooNumber),
    operatingMargins: Type.Optional(YahooNumber),
    profitMargins: Type.Optional(YahooNumber),
    financialCurrency: Type.Union([Type.String(), Type.Null()]),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFinancialData',
  }
);
var RevenueEstimateSchema = Type.Object(
  {
    avg: NullableYahooNumber,
    low: NullableYahooNumber,
    high: NullableYahooNumber,
    numberOfAnalysts: NullableYahooNumber,
    yearAgoRevenue: NullableYahooNumber,
    growth: NullableYahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryRevenueEstimate',
  }
);
var EpsTrendSchema = Type.Object(
  {
    current: NullableYahooNumber,
    '7daysAgo': NullableYahooNumber,
    '30daysAgo': NullableYahooNumber,
    '60daysAgo': NullableYahooNumber,
    '90daysAgo': NullableYahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEpsTrend',
  }
);
var EpsRevisionsSchema = Type.Object(
  {
    upLast7days: NullableYahooNumber,
    upLast30days: NullableYahooNumber,
    downLast30days: NullableYahooNumber,
    downLast90days: NullableYahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEpsRevisions',
  }
);
var EarningsEstimateSchema = Type.Object(
  {
    avg: NullableYahooNumber,
    low: NullableYahooNumber,
    high: NullableYahooNumber,
    yearAgoEps: NullableYahooNumber,
    numberOfAnalysts: NullableYahooNumber,
    growth: NullableYahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsEstimate',
  }
);
var EarningsTrendTrendSchema = Type.Object(
  {
    maxAge: YahooNumber,
    period: Type.String(),
    endDate: NullableYahooFinanceDate,
    growth: NullableYahooNumber,
    earningsEstimate: EarningsEstimateSchema,
    revenueEstimate: RevenueEstimateSchema,
    epsTrend: EpsTrendSchema,
    epsRevisions: EpsRevisionsSchema,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsTrendTrend',
  }
);
var EarningsTrendSchema = Type.Object(
  {
    trend: Type.Array(EarningsTrendTrendSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsTrend',
  }
);
var EarningsHistoryHistorySchema = Type.Object(
  {
    maxAge: YahooNumber,
    epsActual: NullableYahooNumber,
    epsEstimate: NullableYahooNumber,
    epsDifference: NullableYahooNumber,
    surprisePercent: NullableYahooNumber,
    quarter: NullableYahooFinanceDate,
    period: Type.String(),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsHistoryHistory',
  }
);
var EarningsHistorySchema = Type.Object(
  {
    history: Type.Array(EarningsHistoryHistorySchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsHistory',
  }
);
var YearlySchema = Type.Object(
  {
    date: YahooNumber,
    revenue: YahooNumber,
    earnings: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryYearly',
  }
);
var FinancialsChartQuarterlySchema = Type.Object(
  {
    date: Type.String(),
    revenue: YahooNumber,
    earnings: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFinancialsChartQuarterly',
  }
);
var FinancialsChartSchema = Type.Object(
  {
    yearly: Type.Array(YearlySchema),
    quarterly: Type.Array(FinancialsChartQuarterlySchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryFinancialsChart',
  }
);
var EarningsChartQuarterlySchema = Type.Object(
  {
    date: Type.String(),
    actual: YahooNumber,
    estimate: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsChartQuarterly',
  }
);
var EarningsChartSchema = Type.Object(
  {
    quarterly: Type.Array(EarningsChartQuarterlySchema),
    currentQuarterEstimate: Type.Optional(YahooNumber),
    currentQuarterEstimateDate: Type.Optional(Type.String()),
    currentQuarterEstimateYear: Type.Optional(YahooNumber),
    earningsDate: Type.Array(YahooFinanceDate),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarningsChart',
  }
);
var QuoteSummaryEarningsSchema = Type.Object(
  {
    maxAge: YahooNumber,
    earningsChart: EarningsChartSchema,
    financialsChart: FinancialsChartSchema,
    financialCurrency: Type.Optional(Type.String()),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryEarnings',
  }
);
var DefaultKeyStatisticsSchema = Type.Object(
  {
    maxAge: YahooNumber,
    priceHint: YahooNumber,
    enterpriseValue: Type.Optional(YahooNumber),
    forwardPE: Type.Optional(YahooNumber),
    profitMargins: Type.Optional(YahooNumber),
    floatShares: Type.Optional(YahooNumber),
    sharesOutstanding: Type.Optional(YahooNumber),
    sharesShort: Type.Optional(YahooNumber),
    sharesShortPriorMonth: Type.Optional(YahooFinanceDate),
    sharesShortPreviousMonthDate: Type.Optional(YahooFinanceDate),
    dateShortInterest: Type.Optional(YahooNumber),
    sharesPercentSharesOut: Type.Optional(YahooNumber),
    heldPercentInsiders: Type.Optional(YahooNumber),
    heldPercentInstitutions: Type.Optional(YahooNumber),
    shortRatio: Type.Optional(YahooNumber),
    shortPercentOfFloat: Type.Optional(YahooNumber),
    beta: Type.Optional(YahooNumber),
    impliedSharesOutstanding: Type.Optional(YahooNumber),
    category: Type.Union([Type.Null(), Type.String()]),
    bookValue: Type.Optional(YahooNumber),
    priceToBook: Type.Optional(YahooNumber),
    fundFamily: Type.Union([Type.Null(), Type.String()]),
    legalType: Type.Union([Type.Null(), Type.String()]),
    lastFiscalYearEnd: Type.Optional(YahooFinanceDate),
    nextFiscalYearEnd: Type.Optional(YahooFinanceDate),
    mostRecentQuarter: Type.Optional(YahooFinanceDate),
    earningsQuarterlyGrowth: Type.Optional(YahooNumber),
    netIncomeToCommon: Type.Optional(YahooNumber),
    trailingEps: Type.Optional(YahooNumber),
    forwardEps: Type.Optional(YahooNumber),
    pegRatio: Type.Optional(YahooNumber),
    lastSplitFactor: Type.Union([Type.Null(), Type.String()]),
    lastSplitDate: Type.Optional(YahooNumber),
    enterpriseToRevenue: Type.Optional(YahooNumber),
    enterpriseToEbitda: Type.Optional(YahooNumber),
    '52WeekChange': Type.Optional(YahooNumber),
    SandP52WeekChange: Type.Optional(YahooNumber),
    lastDividendValue: Type.Optional(YahooNumber),
    lastDividendDate: Type.Optional(YahooFinanceDate),
    ytdReturn: Type.Optional(YahooNumber),
    beta3Year: Type.Optional(YahooNumber),
    totalAssets: Type.Optional(YahooNumber),
    yield: Type.Optional(YahooNumber),
    fundInceptionDate: Type.Optional(YahooFinanceDate),
    threeYearAverageReturn: Type.Optional(YahooNumber),
    fiveYearAverageReturn: Type.Optional(YahooNumber),
    morningStarOverallRating: Type.Optional(YahooNumber),
    morningStarRiskRating: Type.Optional(YahooNumber),
    annualReportExpenseRatio: Type.Optional(YahooNumber),
    lastCapGain: Type.Optional(YahooNumber),
    annualHoldingsTurnover: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryDefaultKeyStatistics',
  }
);
var CashflowStatementSchema = Type.Object(
  {
    maxAge: YahooNumber,
    endDate: YahooFinanceDate,
    netIncome: YahooNumber,
    depreciation: Type.Optional(YahooNumber),
    changeToNetincome: Type.Optional(YahooNumber),
    changeToAccountReceivables: Type.Optional(YahooNumber),
    changeToLiabilities: Type.Optional(YahooNumber),
    changeToInventory: Type.Optional(YahooNumber),
    changeToOperatingActivities: Type.Optional(YahooNumber),
    totalCashFromOperatingActivities: Type.Optional(YahooNumber),
    capitalExpenditures: Type.Optional(YahooNumber),
    investments: Type.Optional(YahooNumber),
    otherCashflowsFromInvestingActivities: Type.Optional(YahooNumber),
    totalCashflowsFromInvestingActivities: Type.Optional(YahooNumber),
    dividendsPaid: Type.Optional(YahooNumber),
    netBorrowings: Type.Optional(YahooNumber),
    otherCashflowsFromFinancingActivities: Type.Optional(YahooNumber),
    totalCashFromFinancingActivities: Type.Optional(YahooNumber),
    changeInCash: Type.Optional(YahooNumber),
    repurchaseOfStock: Type.Optional(YahooNumber),
    issuanceOfStock: Type.Optional(YahooNumber),
    effectOfExchangeRate: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryCashflowStatement',
  }
);
var CashflowStatementHistorySchema = Type.Object(
  {
    cashflowStatements: Type.Array(CashflowStatementSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryCashflowStatementHistory',
  }
);
var CalendarEventsEarningsSchema = Type.Object(
  {
    earningsDate: Type.Array(YahooFinanceDate),
    earningsAverage: Type.Optional(YahooNumber),
    earningsLow: Type.Optional(YahooNumber),
    earningsHigh: Type.Optional(YahooNumber),
    revenueAverage: Type.Optional(YahooNumber),
    revenueLow: Type.Optional(YahooNumber),
    revenueHigh: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSumamryCalendarEventsEarnings',
  }
);
var CalendarEventsSchema = Type.Object(
  {
    maxAge: YahooNumber,
    earnings: CalendarEventsEarningsSchema,
    exDividendDate: Type.Optional(YahooFinanceDate),
    dividendDate: Type.Optional(YahooFinanceDate),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryCalendarEvents',
  }
);
var BalanceSheetStatementSchema = Type.Object(
  {
    maxAge: YahooNumber,
    endDate: YahooFinanceDate,
    cash: Type.Optional(YahooNumber),
    shortTermInvestments: Type.Optional(YahooNumber),
    netReceivables: Type.Optional(YahooNumber),
    inventory: Type.Optional(YahooNumber),
    otherCurrentAssets: Type.Optional(YahooNumber),
    totalCurrentAssets: Type.Optional(YahooNumber),
    longTermInvestments: Type.Optional(YahooNumber),
    propertyPlantEquipment: Type.Optional(YahooNumber),
    otherAssets: Type.Optional(YahooNumber),
    totalAssets: Type.Optional(YahooNumber),
    accountsPayable: Type.Optional(YahooNumber),
    shortLongTermDebt: Type.Optional(YahooNumber),
    otherCurrentLiab: Type.Optional(YahooNumber),
    longTermDebt: Type.Optional(YahooNumber),
    otherLiab: Type.Optional(YahooNumber),
    totalCurrentLiabilities: Type.Optional(YahooNumber),
    totalLiab: Type.Optional(YahooNumber),
    commonStock: Type.Optional(YahooNumber),
    retainedEarnings: Type.Optional(YahooNumber),
    treasuryStock: Type.Optional(YahooNumber),
    otherStockholderEquity: Type.Optional(YahooNumber),
    totalStockholderEquity: Type.Optional(YahooNumber),
    netTangibleAssets: Type.Optional(YahooNumber),
    goodWill: Type.Optional(YahooNumber),
    intangibleAssets: Type.Optional(YahooNumber),
    deferredLongTermAssetCharges: Type.Optional(YahooNumber),
    deferredLongTermLiab: Type.Optional(YahooNumber),
    minorityInterest: Type.Optional(NullableYahooNumber),
    capitalSurplus: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryBalanceSheetStatement',
  }
);
var BalanceSheetHistorySchema = Type.Object(
  {
    balanceSheetStatements: Type.Array(BalanceSheetStatementSchema),
    maxAge: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryBalanceSheetHistory',
  }
);
var CompanyOfficerSchema = Type.Object(
  {
    maxAge: YahooNumber,
    name: Type.String(),
    age: Type.Optional(YahooNumber),
    title: Type.String(),
    yearBorn: Type.Optional(YahooNumber),
    fiscalYear: Type.Optional(YahooNumber),
    totalPay: Type.Optional(YahooNumber),
    exercisedValue: Type.Optional(YahooNumber),
    unexercisedValue: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryCompanyOfficer',
  }
);
var AssetProfileSchema = Type.Object(
  {
    maxAge: YahooNumber,
    address1: Type.Optional(Type.String()),
    address2: Type.Optional(Type.String()),
    address3: Type.Optional(Type.String()),
    city: Type.Optional(Type.String()),
    state: Type.Optional(Type.String()),
    zip: Type.Optional(Type.String()),
    country: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    fax: Type.Optional(Type.String()),
    website: Type.Optional(Type.String()),
    industry: Type.Optional(Type.String()),
    industryDisp: Type.Optional(Type.String()),
    industryKey: Type.Optional(Type.String()),
    industrySymbol: Type.Optional(Type.String()),
    sector: Type.Optional(Type.String()),
    sectorDisp: Type.Optional(Type.String()),
    sectorKey: Type.Optional(Type.String()),
    longBusinessSummary: Type.Optional(Type.String()),
    fullTimeEmployees: Type.Optional(YahooNumber),
    companyOfficers: Type.Array(CompanyOfficerSchema),
    auditRisk: Type.Optional(YahooNumber),
    boardRisk: Type.Optional(YahooNumber),
    compensationRisk: Type.Optional(YahooNumber),
    shareHolderRightsRisk: Type.Optional(YahooNumber),
    overallRisk: Type.Optional(YahooNumber),
    governanceEpochDate: Type.Optional(YahooFinanceDate),
    compensationAsOfEpochDate: Type.Optional(YahooFinanceDate),
    name: Type.Optional(Type.String()),
    // 'Bitcoin';
    startDate: Type.Optional(YahooFinanceDate),
    // new Date('2013-04-28')
    description: Type.Optional(Type.String()),
    // 'Bitcoin (BTC) is a cryptocurrency...'
    twitter: Type.Optional(Type.String()),
    // in e.g. "ADA-USD" (#418)
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryAssetProfile',
  }
);
var QuoteSummaryResultSchema = Type.Object(
  {
    assetProfile: Type.Optional(AssetProfileSchema),
    balanceSheetHistory: Type.Optional(BalanceSheetHistorySchema),
    balanceSheetHistoryQuarterly: Type.Optional(BalanceSheetHistorySchema),
    calendarEvents: Type.Optional(CalendarEventsSchema),
    cashflowStatementHistory: Type.Optional(CashflowStatementHistorySchema),
    cashflowStatementHistoryQuarterly: Type.Optional(
      CashflowStatementHistorySchema
    ),
    defaultKeyStatistics: Type.Optional(DefaultKeyStatisticsSchema),
    earnings: Type.Optional(QuoteSummaryEarningsSchema),
    earningsHistory: Type.Optional(EarningsHistorySchema),
    earningsTrend: Type.Optional(EarningsTrendSchema),
    financialData: Type.Optional(FinancialDataSchema),
    fundOwnership: Type.Optional(OwnershipSchema),
    fundPerformance: Type.Optional(FundPerformanceSchema),
    fundProfile: Type.Optional(FundProfileSchema),
    incomeStatementHistory: Type.Optional(IncomeStatementHistorySchema),
    incomeStatementHistoryQuarterly: Type.Optional(
      IncomeStatementHistorySchema
    ),
    indexTrend: Type.Optional(IndexTrendSchema),
    industryTrend: Type.Optional(TrendSchema),
    // insiderHolders: Type.Optional(InsiderTransactionsSchema), // <--
    institutionOwnership: Type.Optional(OwnershipSchema),
    majorDirectHolders: Type.Optional(HoldersSchema),
    majorHoldersBreakdown: Type.Optional(MajorHoldersBreakdownSchema),
    netSharePurchaseActivity: Type.Optional(NetSharePurchaseActivitySchema),
    price: Type.Optional(PriceSchema),
    quoteType: Type.Optional(QuoteTypeSchema),
    recommendationTrend: Type.Optional(RecommendationTrendSchema),
    secFilings: Type.Optional(SECFilingsSchema),
    sectorTrend: Type.Optional(TrendSchema),
    summaryDetail: Type.Optional(SummaryDetailSchema),
    summaryProfile: Type.Optional(SummaryProfileSchema),
    topHoldings: Type.Optional(TopHoldingsSchema),
    upgradeDowngradeHistory: Type.Optional(UpgradeDowngradeHistorySchema),
  },
  {
    additionalProperties: Type.Any(),
    title: 'QuoteSummaryResult',
  }
);

// node_modules/yahoo-finance2/dist/esm/src/modules/quoteSummary.js
var QuoteSummaryModules = Type.Union([
  Type.Literal('assetProfile'),
  Type.Literal('balanceSheetHistory'),
  Type.Literal('balanceSheetHistoryQuarterly'),
  Type.Literal('calendarEvents'),
  Type.Literal('cashflowStatementHistory'),
  Type.Literal('cashflowStatementHistoryQuarterly'),
  Type.Literal('defaultKeyStatistics'),
  Type.Literal('earnings'),
  Type.Literal('earningsHistory'),
  Type.Literal('earningsTrend'),
  Type.Literal('financialData'),
  Type.Literal('fundOwnership'),
  Type.Literal('fundPerformance'),
  Type.Literal('fundProfile'),
  Type.Literal('incomeStatementHistory'),
  Type.Literal('incomeStatementHistoryQuarterly'),
  Type.Literal('indexTrend'),
  Type.Literal('industryTrend'),
  Type.Literal('insiderHolders'),
  Type.Literal('insiderTransactions'),
  Type.Literal('institutionOwnership'),
  Type.Literal('majorDirectHolders'),
  Type.Literal('majorHoldersBreakdown'),
  Type.Literal('netSharePurchaseActivity'),
  Type.Literal('price'),
  Type.Literal('quoteType'),
  Type.Literal('recommendationTrend'),
  Type.Literal('secFilings'),
  Type.Literal('sectorTrend'),
  Type.Literal('summaryDetail'),
  Type.Literal('summaryProfile'),
  Type.Literal('topHoldings'),
  Type.Literal('upgradeDowngradeHistory'),
]);
var quoteSummaryModules = [
  'assetProfile',
  'balanceSheetHistory',
  'balanceSheetHistoryQuarterly',
  'calendarEvents',
  'cashflowStatementHistory',
  'cashflowStatementHistoryQuarterly',
  'defaultKeyStatistics',
  'earnings',
  'earningsHistory',
  'earningsTrend',
  'financialData',
  'fundOwnership',
  'fundPerformance',
  'fundProfile',
  'incomeStatementHistory',
  'incomeStatementHistoryQuarterly',
  'indexTrend',
  'industryTrend',
  'insiderHolders',
  'insiderTransactions',
  'institutionOwnership',
  'majorDirectHolders',
  'majorHoldersBreakdown',
  'netSharePurchaseActivity',
  'price',
  'quoteType',
  'recommendationTrend',
  'secFilings',
  'sectorTrend',
  'summaryDetail',
  'summaryProfile',
  'topHoldings',
  'upgradeDowngradeHistory',
];
var QuoteSummaryOptionsSchema = Type.Object({
  formatted: Type.Optional(Type.Boolean()),
  modules: Type.Optional(
    Type.Union([Type.Array(QuoteSummaryModules), Type.Literal('all')])
  ),
});
var queryOptionsDefaults6 = {
  formatted: false,
  modules: ['price', 'summaryDetail'],
};
function quoteSummary(symbol, queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'quoteSummary',
    query: {
      assertSymbol: symbol,
      url: 'https://${YF_QUERY_HOST}/v10/finance/quoteSummary/' + symbol,
      needsCrumb: true,
      schema: QuoteSummaryOptionsSchema,
      defaults: queryOptionsDefaults6,
      overrides: queryOptionsOverrides,
      transformWith(options3) {
        if (
          typeof options3 === 'object' &&
          options3 != null &&
          'modules' in options3 &&
          options3.modules === 'all'
        )
          options3.modules = quoteSummaryModules;
        return options3;
      },
    },
    result: {
      schema: QuoteSummaryResultSchema,
      transformWith(result) {
        if (!result.quoteSummary)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.quoteSummary.result[0];
      },
    },
    moduleOptions,
  });
}
__name(quoteSummary, 'quoteSummary');

// node_modules/yahoo-finance2/dist/esm/src/modules/fundamentalsTimeSeries.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/yahoo-finance2/dist/esm/src/lib/timeseries.json
var timeseries_default = {
  financials: [
    'TotalRevenue',
    'OperatingRevenue',
    'CostOfRevenue',
    'GrossProfit',
    'SellingGeneralAndAdministration',
    'SellingAndMarketingExpense',
    'GeneralAndAdministrativeExpense',
    'OtherGandA',
    'ResearchAndDevelopment',
    'DepreciationAmortizationDepletionIncomeStatement',
    'DepletionIncomeStatement',
    'DepreciationAndAmortizationInIncomeStatement',
    'Amortization',
    'AmortizationOfIntangiblesIncomeStatement',
    'DepreciationIncomeStatement',
    'OtherOperatingExpenses',
    'OperatingExpense',
    'OperatingIncome',
    'InterestExpenseNonOperating',
    'InterestIncomeNonOperating',
    'TotalOtherFinanceCost',
    'NetNonOperatingInterestIncomeExpense',
    'WriteOff',
    'SpecialIncomeCharges',
    'GainOnSaleOfPPE',
    'GainOnSaleOfBusiness',
    'GainOnSaleOfSecurity',
    'OtherSpecialCharges',
    'OtherIncomeExpense',
    'OtherNonOperatingIncomeExpenses',
    'TotalExpenses',
    'PretaxIncome',
    'TaxProvision',
    'NetIncomeContinuousOperations',
    'NetIncomeIncludingNoncontrollingInterests',
    'MinorityInterests',
    'NetIncomeFromTaxLossCarryforward',
    'NetIncomeExtraordinary',
    'NetIncomeDiscontinuousOperations',
    'PreferredStockDividends',
    'OtherunderPreferredStockDividend',
    'NetIncomeCommonStockholders',
    'NetIncome',
    'BasicAverageShares',
    'DilutedAverageShares',
    'DividendPerShare',
    'ReportedNormalizedBasicEPS',
    'ContinuingAndDiscontinuedBasicEPS',
    'BasicEPSOtherGainsLosses',
    'TaxLossCarryforwardBasicEPS',
    'NormalizedBasicEPS',
    'BasicEPS',
    'BasicAccountingChange',
    'BasicExtraordinary',
    'BasicDiscontinuousOperations',
    'BasicContinuousOperations',
    'ReportedNormalizedDilutedEPS',
    'ContinuingAndDiscontinuedDilutedEPS',
    'TaxLossCarryforwardDilutedEPS',
    'AverageDilutionEarnings',
    'NormalizedDilutedEPS',
    'DilutedEPS',
    'DilutedAccountingChange',
    'DilutedExtraordinary',
    'DilutedContinuousOperations',
    'DilutedDiscontinuousOperations',
    'DilutedNIAvailtoComStockholders',
    'DilutedEPSOtherGainsLosses',
    'TotalOperatingIncomeAsReported',
    'NetIncomeFromContinuingAndDiscontinuedOperation',
    'NormalizedIncome',
    'NetInterestIncome',
    'EBIT',
    'EBITDA',
    'ReconciledCostOfRevenue',
    'ReconciledDepreciation',
    'NetIncomeFromContinuingOperationNetMinorityInterest',
    'TotalUnusualItemsExcludingGoodwill',
    'TotalUnusualItems',
    'NormalizedEBITDA',
    'TaxRateForCalcs',
    'TaxEffectOfUnusualItems',
    'RentExpenseSupplemental',
    'EarningsFromEquityInterestNetOfTax',
    'ImpairmentOfCapitalAssets',
    'RestructuringAndMergernAcquisition',
    'SecuritiesAmortization',
    'EarningsFromEquityInterest',
    'OtherTaxes',
    'ProvisionForDoubtfulAccounts',
    'InsuranceAndClaims',
    'RentAndLandingFees',
    'SalariesAndWages',
    'ExciseTaxes',
    'InterestExpense',
    'InterestIncome',
    'TotalMoneyMarketInvestments',
    'InterestIncomeAfterProvisionForLoanLoss',
    'OtherThanPreferredStockDividend',
    'LossonExtinguishmentofDebt',
    'IncomefromAssociatesandOtherParticipatingInterests',
    'NonInterestExpense',
    'OtherNonInterestExpense',
    'ProfessionalExpenseAndContractServicesExpense',
    'OccupancyAndEquipment',
    'Equipment',
    'NetOccupancyExpense',
    'CreditLossesProvision',
    'NonInterestIncome',
    'OtherNonInterestIncome',
    'GainLossonSaleofAssets',
    'GainonSaleofInvestmentProperty',
    'GainonSaleofLoans',
    'ForeignExchangeTradingGains',
    'TradingGainLoss',
    'InvestmentBankingProfit',
    'DividendIncome',
    'FeesAndCommissions',
    'FeesandCommissionExpense',
    'FeesandCommissionIncome',
    'OtherCustomerServices',
    'CreditCard',
    'SecuritiesActivities',
    'TrustFeesbyCommissions',
    'ServiceChargeOnDepositorAccounts',
    'TotalPremiumsEarned',
    'OtherInterestExpense',
    'InterestExpenseForFederalFundsSoldAndSecuritiesPurchaseUnderAgreementsToResell',
    'InterestExpenseForLongTermDebtAndCapitalSecurities',
    'InterestExpenseForShortTermDebt',
    'InterestExpenseForDeposit',
    'OtherInterestIncome',
    'InterestIncomeFromFederalFundsSoldAndSecuritiesPurchaseUnderAgreementsToResell',
    'InterestIncomeFromDeposits',
    'InterestIncomeFromSecurities',
    'InterestIncomeFromLoansAndLease',
    'InterestIncomeFromLeases',
    'InterestIncomeFromLoans',
    'DepreciationDepreciationIncomeStatement',
    'OperationAndMaintenance',
    'OtherCostofRevenue',
    'ExplorationDevelopmentAndMineralPropertyLeaseExpenses',
  ],
  'balance-sheet': [
    'NetDebt',
    'TreasurySharesNumber',
    'PreferredSharesNumber',
    'OrdinarySharesNumber',
    'ShareIssued',
    'TotalDebt',
    'TangibleBookValue',
    'InvestedCapital',
    'WorkingCapital',
    'NetTangibleAssets',
    'CapitalLeaseObligations',
    'CommonStockEquity',
    'PreferredStockEquity',
    'TotalCapitalization',
    'TotalEquityGrossMinorityInterest',
    'MinorityInterest',
    'StockholdersEquity',
    'OtherEquityInterest',
    'GainsLossesNotAffectingRetainedEarnings',
    'OtherEquityAdjustments',
    'FixedAssetsRevaluationReserve',
    'ForeignCurrencyTranslationAdjustments',
    'MinimumPensionLiabilities',
    'UnrealizedGainLoss',
    'TreasuryStock',
    'RetainedEarnings',
    'AdditionalPaidInCapital',
    'CapitalStock',
    'OtherCapitalStock',
    'CommonStock',
    'PreferredStock',
    'TotalPartnershipCapital',
    'GeneralPartnershipCapital',
    'LimitedPartnershipCapital',
    'TotalLiabilitiesNetMinorityInterest',
    'TotalNonCurrentLiabilitiesNetMinorityInterest',
    'OtherNonCurrentLiabilities',
    'LiabilitiesHeldforSaleNonCurrent',
    'RestrictedCommonStock',
    'PreferredSecuritiesOutsideStockEquity',
    'DerivativeProductLiabilities',
    'EmployeeBenefits',
    'NonCurrentPensionAndOtherPostretirementBenefitPlans',
    'NonCurrentAccruedExpenses',
    'DuetoRelatedPartiesNonCurrent',
    'TradeandOtherPayablesNonCurrent',
    'NonCurrentDeferredLiabilities',
    'NonCurrentDeferredRevenue',
    'NonCurrentDeferredTaxesLiabilities',
    'LongTermDebtAndCapitalLeaseObligation',
    'LongTermCapitalLeaseObligation',
    'LongTermDebt',
    'LongTermProvisions',
    'CurrentLiabilities',
    'OtherCurrentLiabilities',
    'CurrentDeferredLiabilities',
    'CurrentDeferredRevenue',
    'CurrentDeferredTaxesLiabilities',
    'CurrentDebtAndCapitalLeaseObligation',
    'CurrentCapitalLeaseObligation',
    'CurrentDebt',
    'OtherCurrentBorrowings',
    'LineOfCredit',
    'CommercialPaper',
    'CurrentNotesPayable',
    'PensionandOtherPostRetirementBenefitPlansCurrent',
    'CurrentProvisions',
    'PayablesAndAccruedExpenses',
    'CurrentAccruedExpenses',
    'InterestPayable',
    'Payables',
    'OtherPayable',
    'DuetoRelatedPartiesCurrent',
    'DividendsPayable',
    'TotalTaxPayable',
    'IncomeTaxPayable',
    'AccountsPayable',
    'TotalAssets',
    'TotalNonCurrentAssets',
    'OtherNonCurrentAssets',
    'DefinedPensionBenefit',
    'NonCurrentPrepaidAssets',
    'NonCurrentDeferredAssets',
    'NonCurrentDeferredTaxesAssets',
    'DuefromRelatedPartiesNonCurrent',
    'NonCurrentNoteReceivables',
    'NonCurrentAccountsReceivable',
    'FinancialAssets',
    'InvestmentsAndAdvances',
    'OtherInvestments',
    'InvestmentinFinancialAssets',
    'HeldToMaturitySecurities',
    'AvailableForSaleSecurities',
    'FinancialAssetsDesignatedasFairValueThroughProfitorLossTotal',
    'TradingSecurities',
    'LongTermEquityInvestment',
    'InvestmentsinJointVenturesatCost',
    'InvestmentsInOtherVenturesUnderEquityMethod',
    'InvestmentsinAssociatesatCost',
    'InvestmentsinSubsidiariesatCost',
    'InvestmentProperties',
    'GoodwillAndOtherIntangibleAssets',
    'OtherIntangibleAssets',
    'Goodwill',
    'NetPPE',
    'AccumulatedDepreciation',
    'GrossPPE',
    'Leases',
    'ConstructionInProgress',
    'OtherProperties',
    'MachineryFurnitureEquipment',
    'BuildingsAndImprovements',
    'LandAndImprovements',
    'Properties',
    'CurrentAssets',
    'OtherCurrentAssets',
    'HedgingAssetsCurrent',
    'AssetsHeldForSaleCurrent',
    'CurrentDeferredAssets',
    'CurrentDeferredTaxesAssets',
    'RestrictedCash',
    'PrepaidAssets',
    'Inventory',
    'InventoriesAdjustmentsAllowances',
    'OtherInventories',
    'FinishedGoods',
    'WorkInProcess',
    'RawMaterials',
    'Receivables',
    'ReceivablesAdjustmentsAllowances',
    'OtherReceivables',
    'DuefromRelatedPartiesCurrent',
    'TaxesReceivable',
    'AccruedInterestReceivable',
    'NotesReceivable',
    'LoansReceivable',
    'AccountsReceivable',
    'AllowanceForDoubtfulAccountsReceivable',
    'GrossAccountsReceivable',
    'CashCashEquivalentsAndShortTermInvestments',
    'OtherShortTermInvestments',
    'CashAndCashEquivalents',
    'CashEquivalents',
    'CashFinancial',
    'OtherLiabilities',
    'LiabilitiesOfDiscontinuedOperations',
    'SubordinatedLiabilities',
    'AdvanceFromFederalHomeLoanBanks',
    'TradingLiabilities',
    'DuetoRelatedParties',
    'SecuritiesLoaned',
    'FederalFundsPurchasedAndSecuritiesSoldUnderAgreementToRepurchase',
    'FinancialInstrumentsSoldUnderAgreementsToRepurchase',
    'FederalFundsPurchased',
    'TotalDeposits',
    'NonInterestBearingDeposits',
    'InterestBearingDepositsLiabilities',
    'CustomerAccounts',
    'DepositsbyBank',
    'OtherAssets',
    'AssetsHeldForSale',
    'DeferredAssets',
    'DeferredTaxAssets',
    'DueFromRelatedParties',
    'AllowanceForNotesReceivable',
    'GrossNotesReceivable',
    'NetLoan',
    'UnearnedIncome',
    'AllowanceForLoansAndLeaseLosses',
    'GrossLoan',
    'OtherLoanAssets',
    'MortgageLoan',
    'ConsumerLoan',
    'CommercialLoan',
    'LoansHeldForSale',
    'DerivativeAssets',
    'SecuritiesAndInvestments',
    'BankOwnedLifeInsurance',
    'OtherRealEstateOwned',
    'ForeclosedAssets',
    'CustomerAcceptances',
    'FederalHomeLoanBankStock',
    'SecurityBorrowed',
    'CashCashEquivalentsAndFederalFundsSold',
    'MoneyMarketInvestments',
    'FederalFundsSoldAndSecuritiesPurchaseUnderAgreementsToResell',
    'SecurityAgreeToBeResell',
    'FederalFundsSold',
    'RestrictedCashAndInvestments',
    'RestrictedInvestments',
    'RestrictedCashAndCashEquivalents',
    'InterestBearingDepositsAssets',
    'CashAndDueFromBanks',
    'BankIndebtedness',
    'MineralProperties',
  ],
  'cash-flow': [
    'FreeCashFlow',
    'ForeignSales',
    'DomesticSales',
    'AdjustedGeographySegmentData',
    'RepurchaseOfCapitalStock',
    'RepaymentOfDebt',
    'IssuanceOfDebt',
    'IssuanceOfCapitalStock',
    'CapitalExpenditure',
    'InterestPaidSupplementalData',
    'IncomeTaxPaidSupplementalData',
    'EndCashPosition',
    'OtherCashAdjustmentOutsideChangeinCash',
    'BeginningCashPosition',
    'EffectOfExchangeRateChanges',
    'ChangesInCash',
    'OtherCashAdjustmentInsideChangeinCash',
    'CashFlowFromDiscontinuedOperation',
    'FinancingCashFlow',
    'CashFromDiscontinuedFinancingActivities',
    'CashFlowFromContinuingFinancingActivities',
    'NetOtherFinancingCharges',
    'InterestPaidCFF',
    'ProceedsFromStockOptionExercised',
    'CashDividendsPaid',
    'PreferredStockDividendPaid',
    'CommonStockDividendPaid',
    'NetPreferredStockIssuance',
    'PreferredStockPayments',
    'PreferredStockIssuance',
    'NetCommonStockIssuance',
    'CommonStockPayments',
    'CommonStockIssuance',
    'NetIssuancePaymentsOfDebt',
    'NetShortTermDebtIssuance',
    'ShortTermDebtPayments',
    'ShortTermDebtIssuance',
    'NetLongTermDebtIssuance',
    'LongTermDebtPayments',
    'LongTermDebtIssuance',
    'InvestingCashFlow',
    'CashFromDiscontinuedInvestingActivities',
    'CashFlowFromContinuingInvestingActivities',
    'NetOtherInvestingChanges',
    'InterestReceivedCFI',
    'DividendsReceivedCFI',
    'NetInvestmentPurchaseAndSale',
    'SaleOfInvestment',
    'PurchaseOfInvestment',
    'NetInvestmentPropertiesPurchaseAndSale',
    'SaleOfInvestmentProperties',
    'PurchaseOfInvestmentProperties',
    'NetBusinessPurchaseAndSale',
    'SaleOfBusiness',
    'PurchaseOfBusiness',
    'NetIntangiblesPurchaseAndSale',
    'SaleOfIntangibles',
    'PurchaseOfIntangibles',
    'NetPPEPurchaseAndSale',
    'SaleOfPPE',
    'PurchaseOfPPE',
    'CapitalExpenditureReported',
    'OperatingCashFlow',
    'CashFromDiscontinuedOperatingActivities',
    'CashFlowFromContinuingOperatingActivities',
    'TaxesRefundPaid',
    'InterestReceivedCFO',
    'InterestPaidCFO',
    'DividendReceivedCFO',
    'DividendPaidCFO',
    'ChangeInWorkingCapital',
    'ChangeInOtherWorkingCapital',
    'ChangeInOtherCurrentLiabilities',
    'ChangeInOtherCurrentAssets',
    'ChangeInPayablesAndAccruedExpense',
    'ChangeInAccruedExpense',
    'ChangeInInterestPayable',
    'ChangeInPayable',
    'ChangeInDividendPayable',
    'ChangeInAccountPayable',
    'ChangeInTaxPayable',
    'ChangeInIncomeTaxPayable',
    'ChangeInPrepaidAssets',
    'ChangeInInventory',
    'ChangeInReceivables',
    'ChangesInAccountReceivables',
    'OtherNonCashItems',
    'ExcessTaxBenefitFromStockBasedCompensation',
    'StockBasedCompensation',
    'UnrealizedGainLossOnInvestmentSecurities',
    'ProvisionandWriteOffofAssets',
    'AssetImpairmentCharge',
    'AmortizationOfSecurities',
    'DeferredTax',
    'DeferredIncomeTax',
    'Depletion',
    'DepreciationAndAmortization',
    'AmortizationCashFlow',
    'AmortizationOfIntangibles',
    'Depreciation',
    'OperatingGainsLosses',
    'PensionAndEmployeeBenefitExpense',
    'EarningsLossesFromEquityInvestments',
    'GainLossOnInvestmentSecurities',
    'NetForeignCurrencyExchangeGainLoss',
    'GainLossOnSaleOfPPE',
    'GainLossOnSaleOfBusiness',
    'NetIncomeFromContinuingOperations',
    'CashFlowsfromusedinOperatingActivitiesDirect',
    'TaxesRefundPaidDirect',
    'InterestReceivedDirect',
    'InterestPaidDirect',
    'DividendsReceivedDirect',
    'DividendsPaidDirect',
    'ClassesofCashPayments',
    'OtherCashPaymentsfromOperatingActivities',
    'PaymentsonBehalfofEmployees',
    'PaymentstoSuppliersforGoodsandServices',
    'ClassesofCashReceiptsfromOperatingActivities',
    'OtherCashReceiptsfromOperatingActivities',
    'ReceiptsfromGovernmentGrants',
    'ReceiptsfromCustomers',
    'IncreaseDecreaseInDeposit',
    'ChangeInFederalFundsAndSecuritiesSoldForRepurchase',
    'NetProceedsPaymentForLoan',
    'PaymentForLoans',
    'ProceedsFromLoans',
    'ProceedsPaymentInInterestBearingDepositsInBank',
    'IncreaseinInterestBearingDepositsinBank',
    'DecreaseinInterestBearingDepositsinBank',
    'ProceedsPaymentFederalFundsSoldAndSecuritiesPurchasedUnderAgreementToResell',
    'ChangeInLoans',
    'ChangeInDeferredCharges',
    'ProvisionForLoanLeaseAndOtherLosses',
    'AmortizationOfFinancingCostsAndDiscounts',
    'DepreciationAmortizationDepletion',
    'RealizedGainLossOnSaleOfLoansAndLease',
    'AllTaxesPaid',
    'InterestandCommissionPaid',
    'CashPaymentsforLoans',
    'CashPaymentsforDepositsbyBanksandCustomers',
    'CashReceiptsfromFeesandCommissions',
    'CashReceiptsfromSecuritiesRelatedActivities',
    'CashReceiptsfromLoans',
    'CashReceiptsfromDepositsbyBanksandCustomers',
    'CashReceiptsfromTaxRefunds',
    'AmortizationAmortizationCashFlow',
  ],
};

// node_modules/yahoo-finance2/dist/esm/src/modules/fundamentalsTimeSeries.js
var FundamentalsTimeSeries_Types = ['quarterly', 'annual', 'trailing'];
var FundamentalsTimeSeries_Modules = [
  'financials',
  'balance-sheet',
  'cash-flow',
  'all',
];
var FundamentalsTimeSeriesResultSchema = Type.Object(
  {
    date: YahooFinanceDate,
  },
  {
    additionalProperties: Type.Unknown(),
    title: 'FundamentalsTimeSeriesResult',
  }
);
var FundamentalsTimeSeriesOptionsSchema = Type.Object(
  {
    period1: Type.Union([YahooFinanceDate, YahooNumber, Type.String()]),
    period2: Type.Optional(
      Type.Union([YahooFinanceDate, YahooNumber, Type.String()])
    ),
    type: Type.Optional(Type.String()),
    merge: Type.Optional(Type.Boolean()),
    // This returns a completely different format that will break the transformer
    padTimeSeries: Type.Optional(Type.Boolean()),
    // Not exactly sure what this does, assume it pads p1 and p2???
    lang: Type.Optional(Type.String()),
    region: Type.Optional(Type.String()),
    module: Type.String(),
  },
  {
    title: 'FundamentalsTimeSeriesOptions',
  }
);
var FundamentalsTimeSeriesResultsSchema = Type.Array(
  FundamentalsTimeSeriesResultSchema
);
var queryOptionsDefaults7 = {
  merge: false,
  padTimeSeries: true,
  lang: 'en-US',
  region: 'US',
  type: 'quarterly',
};
function fundamentalsTimeSeries(symbol, queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'options',
    query: {
      assertSymbol: symbol,
      url: `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}`,
      needsCrumb: false,
      schema: FundamentalsTimeSeriesOptionsSchema,
      defaults: queryOptionsDefaults7,
      overrides: queryOptionsOverrides,
      transformWith: processQuery,
    },
    result: {
      schema: FundamentalsTimeSeriesResultsSchema,
      transformWith(response) {
        if (!response || !response.timeseries)
          throw new Error(`Unexpected result: ${JSON.stringify(response)}`);
        return processResponse(response);
      },
    },
    moduleOptions,
  });
}
__name(fundamentalsTimeSeries, 'fundamentalsTimeSeries');
var processQuery = /* @__PURE__ */ __name(function (queryOptions) {
  if (!queryOptions.period2) queryOptions.period2 = /* @__PURE__ */ new Date();
  const dates = ['period1', 'period2'];
  for (const fieldName of dates) {
    const value = queryOptions[fieldName];
    if (value instanceof Date)
      queryOptions[fieldName] = Math.floor(value.getTime() / 1e3);
    else if (typeof value === 'string') {
      const timestamp = new Date(value).getTime();
      if (isNaN(timestamp))
        throw new Error(
          "yahooFinance.fundamentalsTimeSeries() option '" +
            fieldName +
            "' invalid date provided: '" +
            value +
            "'"
        );
      queryOptions[fieldName] = Math.floor(timestamp / 1e3);
    }
  }
  if (queryOptions.period1 === queryOptions.period2) {
    throw new Error(
      'yahooFinance.fundamentalsTimeSeries() options `period1` and `period2` cannot share the same value.'
    );
  } else if (!FundamentalsTimeSeries_Types.includes(queryOptions.type || '')) {
    throw new Error(
      'yahooFinance.fundamentalsTimeSeries() option type invalid.'
    );
  } else if (
    !FundamentalsTimeSeries_Modules.includes(queryOptions.module || '')
  ) {
    throw new Error(
      'yahooFinance.fundamentalsTimeSeries() option module invalid.'
    );
  }
  const keys = Object.entries(timeseries_default).reduce(
    (previous, [module, keys2]) => {
      if (queryOptions.module == 'all') {
        return previous.concat(keys2);
      } else if (module == queryOptions.module) {
        return previous.concat(keys2);
      } else return previous;
    },
    []
  );
  const queryType = queryOptions.type + keys.join(`,${queryOptions.type}`);
  return {
    period1: queryOptions.period1,
    period2: queryOptions.period2,
    type: queryType,
  };
}, 'processQuery');
var processResponse = /* @__PURE__ */ __name(function (response) {
  const keyedByTimestamp = {};
  const replace = new RegExp(FundamentalsTimeSeries_Types.join('|'));
  for (let ct = 0; ct < response.timeseries.result.length; ct++) {
    const result = response.timeseries.result[ct];
    if (!result.timestamp || !result.timestamp.length) {
      continue;
    }
    for (let ct2 = 0; ct2 < result.timestamp.length; ct2++) {
      const timestamp = result.timestamp[ct2];
      const dataKey = Object.keys(result)[2];
      if (!keyedByTimestamp[timestamp]) {
        keyedByTimestamp[timestamp] = { date: timestamp };
      }
      if (
        !result[dataKey][ct2] ||
        !result[dataKey][ct2].reportedValue ||
        !result[dataKey][ct2].reportedValue.raw
      ) {
        continue;
      }
      const short = dataKey.replace(replace, '');
      const key =
        short == short.toUpperCase()
          ? short
          : short[0].toLowerCase() + short.slice(1);
      keyedByTimestamp[timestamp][key] = result[dataKey][ct2].reportedValue.raw;
    }
  }
  return Object.keys(keyedByTimestamp).map((k) => keyedByTimestamp[k]);
}, 'processResponse');

// node_modules/yahoo-finance2/dist/esm/src/modules/recommendationsBySymbol.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var RecommendationsBySymbolResponse = Type.Object(
  {
    recommendedSymbols: Type.Array(
      Type.Object(
        {
          score: YahooNumber,
          // 0.1927
          symbol: Type.String(),
          // "BMW.DE"
        },
        {
          additionalProperties: Type.Any(),
        }
      )
    ),
    symbol: Type.String(),
  },
  {
    additionalProperties: Type.Any(),
  }
);
var RecommendationsBySymbolResponseArray = Type.Array(
  RecommendationsBySymbolResponse
);
var RecommendationsBySymbolOptions = Type.Object({});
var queryOptionsDefaults8 = {};
function recommendationsBySymbol(query, queryOptionsOverrides, moduleOptions) {
  const symbols = typeof query === 'string' ? query : query.join(',');
  return this._moduleExec({
    moduleName: 'recommendationsBySymbol',
    query: {
      url:
        'https://${YF_QUERY_HOST}/v6/finance/recommendationsbysymbol/' +
        symbols,
      schema: RecommendationsBySymbolOptions,
      defaults: queryOptionsDefaults8,
      overrides: queryOptionsOverrides,
    },
    result: {
      schema: RecommendationsBySymbolResponseArray,
      transformWith(result) {
        if (!result.finance)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.finance.result;
      },
    },
    moduleOptions,
  }).then((results) => {
    return typeof query === 'string' ? results[0] : results;
  });
}
__name(recommendationsBySymbol, 'recommendationsBySymbol');

// node_modules/yahoo-finance2/dist/esm/src/modules/search.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var SearchQuoteYahoo = Type.Object(
  {
    symbol: Type.String(),
    // "BABA"
    isYahooFinance: Type.Literal(true),
    // true
    exchange: Type.String(),
    // "NYQ"
    exchDisp: Type.Optional(Type.String()),
    // "London", e.g. with BJ0CDD2
    shortname: Type.Optional(Type.String()),
    // "Alibaba Group Holding Limited"
    longname: Type.Optional(Type.String()),
    // "Alibaba Group Holding Limited"
    index: Type.Literal('quotes'),
    // "quotes"
    score: YahooNumber,
    // 1111958.0
    newListingDate: Type.Optional(YahooFinanceDate),
    // "2021-02-16"
    prevName: Type.Optional(Type.String()),
    nameChangeDate: Type.Optional(YahooFinanceDate),
    sector: Type.Optional(Type.String()),
    // "Industrials"
    industry: Type.Optional(Type.String()),
    // "Building Products & Equipment"
    dispSecIndFlag: Type.Optional(Type.Boolean()),
    // true
  },
  {
    additionalProperties: Type.Any(),
  }
);
var SearchQuoteYahooEquity = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('EQUITY'),
      typeDisp: Type.Literal('Equity'),
    }),
  ],
  {
    title: 'SearchQuoteYahooEntity',
  }
);
var SearchQuoteYahooOption = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('OPTION'),
      typeDisp: Type.Literal('Option'),
    }),
  ],
  {
    title: 'SearchQuoteYahooOption',
  }
);
var SearchQuoteYahooETF = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('ETF'),
      typeDisp: Type.Literal('ETF'),
    }),
  ],
  {
    title: 'SearchQuoteYahooETF',
  }
);
var SearchQuoteYahooFund = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('MUTUALFUND'),
      typeDisp: Type.Literal('Fund'),
    }),
  ],
  {
    title: 'SearchQuoteYahooFund',
  }
);
var SearchQuoteYahooIndex = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('INDEX'),
      typeDisp: Type.Literal('Index'),
    }),
  ],
  {
    title: 'SearchQuoteYahooIndex',
  }
);
var SearchQuoteYahooCurrency = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('CURRENCY'),
      typeDisp: Type.Literal('Currency'),
    }),
  ],
  {
    title: 'SearchQuoteYahooCurrency',
  }
);
var SearchQuoteYahooCryptocurrency = Type.Composite([
  SearchQuoteYahoo,
  Type.Object({
    quoteType: Type.Literal('CRYPTOCURRENCY'),
    typeDisp: Type.Literal('Cryptocurrency'),
  }),
]);
var SearchQuoteYahooFuture = Type.Composite(
  [
    SearchQuoteYahoo,
    Type.Object({
      quoteType: Type.Literal('FUTURE'),
      typeDisp: Type.Union([Type.Literal('Future'), Type.Literal('Futures')]),
    }),
  ],
  {
    title: 'SearchQuoteYahooFuture',
  }
);
var SearchQuoteNonYahoo = Type.Object(
  {
    index: Type.String(),
    // '78ddc07626ff4bbcae663e88514c23a0'
    name: Type.String(),
    // 'AAPlasma'
    permalink: Type.String(),
    // 'aaplasma'
    isYahooFinance: Type.Literal(false),
    // false
  },
  {
    additionalProperties: Type.Any(),
    title: 'SearchQuoteNonYahoo',
  }
);
var SearchNewsThumbnailResolution = Type.Object(
  {
    url: Type.String(),
    width: YahooNumber,
    height: YahooNumber,
    tag: Type.String(),
  },
  {
    title: 'SearchNewsThumbnailResolution',
  }
);
var SearchNews = Type.Object(
  {
    uuid: Type.String(),
    // "9aff624a-e84c-35f3-9c23-db39852006dc"
    title: Type.String(),
    // "Analyst Report: Alibaba Group Holding Limited"
    publisher: Type.String(),
    // "Morningstar Research"
    link: Type.String(),
    // "https://finance.yahoo.com/m/9aff624a-e84c-35f3-9c23-db39852006dc/analyst-report%3A-alibaba-group.html"
    providerPublishTime: YahooFinanceDate,
    // coerced to New Date(1611285342 * 1000)
    type: Type.String(),
    // "STORY"   TODO "STORY" | ???
    thumbnail: Type.Optional(
      Type.Object({
        resolutions: Type.Array(SearchNewsThumbnailResolution),
      })
    ),
    relatedTickers: Type.Optional(Type.Array(Type.String())),
    // [ "AAPL" ]
  },
  {
    additionalProperties: Type.Any(),
    title: 'SearchNews',
  }
);
var SearchResultSchema = Type.Object(
  {
    explains: Type.Array(Type.Any()),
    count: YahooNumber,
    quotes: Type.Array(
      Type.Union([
        SearchQuoteYahooEquity,
        SearchQuoteYahooOption,
        SearchQuoteYahooETF,
        SearchQuoteYahooFund,
        SearchQuoteYahooIndex,
        SearchQuoteYahooCurrency,
        SearchQuoteYahooCryptocurrency,
        SearchQuoteNonYahoo,
        SearchQuoteYahooFuture,
      ])
    ),
    news: Type.Array(SearchNews),
    nav: Type.Array(Type.Any()),
    lists: Type.Array(Type.Any()),
    researchReports: Type.Array(Type.Any()),
    totalTime: YahooNumber,
    // ALWAYS present, but TEMPORARILY marked optional ("?") since its
    // sudden appearance, let's make sure it doesn't get suddenly removed.
    // Array<any> until we can find some examples of what it actually looks
    // like (#255).
    screenerFieldResults: Type.Optional(Type.Array(Type.Any())),
    // ALWAYS present, but TEMPORARILY marked optional ("?") since its
    // sudden appearance, let's make sure it doesn't get suddenly removed.
    // Array<any> until we can find some examples of what it actually looks
    // like (#399).
    culturalAssets: Type.Optional(Type.Array(Type.Any())),
    timeTakenForQuotes: YahooNumber,
    // 26
    timeTakenForNews: YahooNumber,
    // 419
    timeTakenForAlgowatchlist: YahooNumber,
    // 700
    timeTakenForPredefinedScreener: YahooNumber,
    // 400
    timeTakenForCrunchbase: YahooNumber,
    // 400
    timeTakenForNav: YahooNumber,
    // 400
    timeTakenForResearchReports: YahooNumber,
    // 0
    // ALWAYS present, but TEMPORARILY marked optional ("?") since its
    // sudden appearance, let's make sure it doesn't get suddenly removed.
    timeTakenForScreenerField: Type.Optional(YahooNumber),
    // ALWAYS present, but TEMPORARILY marked optional ("?") since its
    // sudden appearance, let's make sure it doesn't get suddenly removed.
    timeTakenForCulturalAssets: Type.Optional(YahooNumber),
  },
  {
    additionalProperties: Type.Any(),
    title: 'SearchResults',
  }
);
var SearchOptionsSchema = Type.Object(
  {
    lang: Type.Optional(Type.String()),
    region: Type.Optional(Type.String()),
    quotesCount: Type.Optional(YahooNumber),
    newsCount: Type.Optional(YahooNumber),
    enableFuzzyQuery: Type.Optional(Type.Boolean()),
    quotesQueryId: Type.Optional(Type.String()),
    multiQuoteQueryId: Type.Optional(Type.String()),
    newsQueryId: Type.Optional(Type.String()),
    enableCb: Type.Optional(Type.Boolean()),
    enableNavLinks: Type.Optional(Type.Boolean()),
    enableEnhancedTrivialQuery: Type.Optional(Type.Boolean()),
  },
  {
    title: 'SearchOptions',
    additionalProperties: false,
  }
);
var queryOptionsDefaults9 = {
  lang: 'en-US',
  region: 'US',
  quotesCount: 6,
  newsCount: 4,
  enableFuzzyQuery: false,
  quotesQueryId: 'tss_match_phrase_query',
  multiQuoteQueryId: 'multi_quote_single_token_query',
  newsQueryId: 'news_cie_vespa',
  enableCb: true,
  enableNavLinks: true,
  enableEnhancedTrivialQuery: true,
};
function search(query, queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'searchTypebox',
    query: {
      url: 'https://${YF_QUERY_HOST}/v1/finance/search',
      schema: SearchOptionsSchema,
      defaults: queryOptionsDefaults9,
      runtime: { q: query },
      overrides: queryOptionsOverrides,
      needsCrumb: false,
    },
    result: {
      schema: SearchResultSchema,
    },
    moduleOptions,
  });
}
__name(search, 'search');

// node_modules/yahoo-finance2/dist/esm/src/modules/trendingSymbols.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TrendingSymbol = Type.Object(
  {
    symbol: Type.String(),
  },
  {
    additionalProperties: Type.Any(),
  }
);
var TrendingSymbolsResult = Type.Object(
  {
    count: YahooNumber,
    quotes: Type.Array(TrendingSymbol),
    jobTimestamp: YahooNumber,
    startInterval: YahooNumber,
  },
  {
    additionalProperties: Type.Any(),
    title: 'TrendingSymbolsResult',
  }
);
var TrendingSymbolsOptions = Type.Optional(
  Type.Object(
    {
      lang: Type.Optional(Type.String()),
      region: Type.Optional(Type.String()),
      count: Type.Optional(YahooNumber),
    },
    {
      title: 'TrendingSymbolsOptions',
    }
  )
);
var queryOptionsDefaults10 = {
  lang: 'en-US',
  count: 5,
};
function trendingSymbols2(query, queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'trendingSymbols',
    query: {
      url: 'https://${YF_QUERY_HOST}/v1/finance/trending/' + query,
      schema: TrendingSymbolsOptions,
      defaults: queryOptionsDefaults10,
      overrides: queryOptionsOverrides,
    },
    result: {
      schema: TrendingSymbolsResult,
      transformWith(result) {
        if (!result.finance)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.finance.result[0];
      },
    },
    moduleOptions,
  });
}
__name(trendingSymbols2, 'trendingSymbols');

// node_modules/yahoo-finance2/dist/esm/src/modules/dailyGainers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DailyGainersCriterum = Type.Object(
  {
    field: Type.String(),
    operators: Type.Array(Type.String()),
    values: Type.Array(YahooNumber),
    labelsSelected: Type.Array(YahooNumber),
    dependentValues: Type.Array(Type.Any()),
  },
  { title: 'DailyGainersCriterium' }
);
var DailyGainersQuote = Type.Object(
  {
    language: Type.String(),
    region: Type.String(),
    quoteType: Type.String(),
    typeDisp: Type.String(),
    quoteSourceName: Type.String(),
    triggerable: Type.Boolean(),
    customPriceAlertConfidence: Type.String(),
    lastCloseTevEbitLtm: Type.Optional(YahooNumber),
    lastClosePriceToNNWCPerShare: Type.Optional(YahooNumber),
    firstTradeDateMilliseconds: YahooNumber,
    priceHint: YahooNumber,
    postMarketChangePercent: Type.Optional(YahooNumber),
    postMarketTime: Type.Optional(YahooNumber),
    postMarketPrice: Type.Optional(YahooNumber),
    postMarketChange: Type.Optional(YahooNumber),
    regularMarketChange: YahooNumber,
    regularMarketTime: YahooNumber,
    regularMarketPrice: YahooNumber,
    regularMarketDayHigh: YahooNumber,
    regularMarketDayRange: Type.String(),
    currency: Type.String(),
    regularMarketDayLow: YahooNumber,
    regularMarketVolume: YahooNumber,
    regularMarketPreviousClose: YahooNumber,
    bid: Type.Optional(YahooNumber),
    ask: Type.Optional(YahooNumber),
    bidSize: Type.Optional(YahooNumber),
    askSize: Type.Optional(YahooNumber),
    market: Type.String(),
    messageBoardId: Type.String(),
    fullExchangeName: Type.String(),
    longName: Type.String(),
    financialCurrency: Type.Optional(Type.String()),
    regularMarketOpen: YahooNumber,
    averageDailyVolume3Month: YahooNumber,
    averageDailyVolume10Day: YahooNumber,
    fiftyTwoWeekLowChange: YahooNumber,
    fiftyTwoWeekLowChangePercent: YahooNumber,
    fiftyTwoWeekRange: Type.String(),
    fiftyTwoWeekHighChange: YahooNumber,
    fiftyTwoWeekHighChangePercent: YahooNumber,
    fiftyTwoWeekChangePercent: YahooNumber,
    earningsTimestamp: Type.Optional(YahooNumber),
    earningsTimestampStart: Type.Optional(YahooNumber),
    earningsTimestampEnd: Type.Optional(YahooNumber),
    trailingAnnualDividendRate: YahooNumber,
    trailingAnnualDividendYield: YahooNumber,
    marketState: Type.String(),
    epsTrailingTwelveMonths: Type.Optional(YahooNumber),
    epsForward: Type.Optional(YahooNumber),
    epsCurrentYear: Type.Optional(YahooNumber),
    priceEpsCurrentYear: Type.Optional(YahooNumber),
    sharesOutstanding: YahooNumber,
    bookValue: Type.Optional(YahooNumber),
    fiftyDayAverage: YahooNumber,
    fiftyDayAverageChange: YahooNumber,
    fiftyDayAverageChangePercent: YahooNumber,
    twoHundredDayAverage: YahooNumber,
    twoHundredDayAverageChange: YahooNumber,
    twoHundredDayAverageChangePercent: YahooNumber,
    marketCap: YahooNumber,
    forwardPE: Type.Optional(YahooNumber),
    priceToBook: Type.Optional(YahooNumber),
    sourceInterval: YahooNumber,
    exchangeDataDelayedBy: YahooNumber,
    exchangeTimezoneName: Type.String(),
    exchangeTimezoneShortName: Type.String(),
    gmtOffSetMilliseconds: YahooNumber,
    esgPopulated: Type.Boolean(),
    tradeable: Type.Boolean(),
    cryptoTradeable: Type.Boolean(),
    exchange: Type.String(),
    fiftyTwoWeekLow: YahooNumber,
    fiftyTwoWeekHigh: YahooNumber,
    shortName: Type.String(),
    averageAnalystRating: Type.Optional(Type.String()),
    regularMarketChangePercent: YahooNumber,
    symbol: Type.String(),
    dividendDate: Type.Optional(YahooNumber),
    displayName: Type.Optional(Type.String()),
    trailingPE: Type.Optional(YahooNumber),
    prevName: Type.Optional(Type.String()),
    nameChangeDate: Type.Optional(YahooNumber),
    ipoExpectedDate: Type.Optional(YahooNumber),
    dividendYield: Type.Optional(YahooNumber),
    dividendRate: Type.Optional(YahooNumber),
  },
  { title: 'DailyGainersQuote' }
);
var DailyGainersOptionsSchema = Type.Object(
  {
    lang: Type.Optional(Type.String()),
    region: Type.Optional(Type.String()),
    count: Type.Optional(YahooNumber),
  },
  { title: 'DailyGainersOptions' }
);
var DailyGainersCriteriaMeta = Type.Object(
  {
    size: YahooNumber,
    offset: YahooNumber,
    sortField: Type.String(),
    sortType: Type.String(),
    quoteType: Type.String(),
    criteria: Type.Array(DailyGainersCriterum),
    topOperator: Type.String(),
  },
  { title: 'DailyGainersCriteriaMeta' }
);
var DailyGainersResultSchema = Type.Object(
  {
    id: Type.String(),
    title: Type.String(),
    description: Type.String(),
    canonicalName: Type.String(),
    criteriaMeta: DailyGainersCriteriaMeta,
    rawCriteria: Type.String(),
    start: YahooNumber,
    count: YahooNumber,
    total: YahooNumber,
    quotes: Type.Array(DailyGainersQuote),
    useRecords: Type.Boolean(),
    predefinedScr: Type.Boolean(),
    versionId: YahooNumber,
    creationDate: YahooNumber,
    lastUpdated: YahooNumber,
    isPremium: Type.Boolean(),
    iconUrl: Type.String(),
  },
  { title: 'DailyGainersResult' }
);
var queryOptionsDefaults11 = {
  lang: 'en-US',
  region: 'US',
  scrIds: 'day_gainers',
  count: 5,
};
function dailyGainers(queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'dailyGainers',
    query: {
      url: 'https://${YF_QUERY_HOST}/v1/finance/screener/predefined/saved',
      schema: DailyGainersOptionsSchema,
      defaults: queryOptionsDefaults11,
      overrides: queryOptionsOverrides,
      needsCrumb: true,
    },
    result: {
      schema: DailyGainersResultSchema,
      transformWith(result) {
        if (!result.finance)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.finance.result[0];
      },
    },
    moduleOptions,
  });
}
__name(dailyGainers, 'dailyGainers');

// node_modules/yahoo-finance2/dist/esm/src/modules/screener.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ScreenerCriterum = Type.Object(
  {
    field: Type.String(),
    operators: Type.Array(Type.String()),
    values: Type.Array(YahooNumber),
    labelsSelected: Type.Array(YahooNumber),
    dependentValues: Type.Array(Type.Any()),
  },
  {
    title: 'ScreenerCriterum',
  }
);
var ScreenerCriteriaMeta = Type.Object(
  {
    size: YahooNumber,
    offset: YahooNumber,
    sortField: Type.String(),
    sortType: Type.String(),
    quoteType: Type.String(),
    criteria: Type.Array(ScreenerCriterum),
    topOperator: Type.String(),
  },
  {
    title: 'ScreenerCriteriaMeta',
  }
);
var ScreenerQuote = Type.Object(
  {
    language: Type.String(),
    region: Type.String(),
    quoteType: Type.String(),
    typeDisp: Type.String(),
    quoteSourceName: Type.String(),
    triggerable: Type.Boolean(),
    customPriceAlertConfidence: Type.String(),
    lastCloseTevEbitLtm: Type.Optional(YahooNumber),
    lastClosePriceToNNWCPerShare: Type.Optional(YahooNumber),
    firstTradeDateMilliseconds: YahooNumber,
    priceHint: YahooNumber,
    postMarketChangePercent: Type.Optional(YahooNumber),
    postMarketTime: Type.Optional(YahooNumber),
    postMarketPrice: Type.Optional(YahooNumber),
    postMarketChange: Type.Optional(YahooNumber),
    regularMarketChange: YahooNumber,
    regularMarketTime: YahooNumber,
    regularMarketPrice: YahooNumber,
    regularMarketDayHigh: Type.Optional(YahooNumber),
    regularMarketDayRange: YahooTwoNumberRange,
    currency: Type.String(),
    regularMarketDayLow: Type.Optional(YahooNumber),
    regularMarketVolume: Type.Optional(YahooNumber),
    regularMarketPreviousClose: YahooNumber,
    bid: Type.Optional(YahooNumber),
    ask: Type.Optional(YahooNumber),
    bidSize: Type.Optional(YahooNumber),
    askSize: Type.Optional(YahooNumber),
    market: Type.String(),
    messageBoardId: Type.String(),
    fullExchangeName: Type.String(),
    longName: Type.String(),
    financialCurrency: Type.Optional(Type.String()),
    regularMarketOpen: Type.Optional(YahooNumber),
    averageDailyVolume3Month: YahooNumber,
    averageDailyVolume10Day: YahooNumber,
    fiftyTwoWeekLowChange: YahooNumber,
    fiftyTwoWeekLowChangePercent: YahooNumber,
    fiftyTwoWeekRange: YahooTwoNumberRange,
    fiftyTwoWeekHighChange: YahooNumber,
    fiftyTwoWeekHighChangePercent: YahooNumber,
    fiftyTwoWeekChangePercent: YahooNumber,
    earningsTimestamp: Type.Optional(YahooNumber),
    earningsTimestampStart: Type.Optional(YahooNumber),
    earningsTimestampEnd: Type.Optional(YahooNumber),
    trailingAnnualDividendRate: Type.Optional(YahooNumber),
    trailingAnnualDividendYield: Type.Optional(YahooNumber),
    marketState: Type.String(),
    epsTrailingTwelveMonths: Type.Optional(YahooNumber),
    epsForward: Type.Optional(YahooNumber),
    epsCurrentYear: Type.Optional(YahooNumber),
    priceEpsCurrentYear: Type.Optional(YahooNumber),
    sharesOutstanding: Type.Optional(YahooNumber),
    bookValue: Type.Optional(YahooNumber),
    fiftyDayAverage: YahooNumber,
    fiftyDayAverageChange: YahooNumber,
    fiftyDayAverageChangePercent: YahooNumber,
    twoHundredDayAverage: YahooNumber,
    twoHundredDayAverageChange: YahooNumber,
    twoHundredDayAverageChangePercent: YahooNumber,
    marketCap: Type.Optional(YahooNumber),
    forwardPE: Type.Optional(YahooNumber),
    priceToBook: Type.Optional(YahooNumber),
    sourceInterval: YahooNumber,
    exchangeDataDelayedBy: YahooNumber,
    exchangeTimezoneName: Type.String(),
    exchangeTimezoneShortName: Type.String(),
    gmtOffSetMilliseconds: YahooNumber,
    esgPopulated: Type.Boolean(),
    tradeable: Type.Boolean(),
    cryptoTradeable: Type.Boolean(),
    exchange: Type.String(),
    fiftyTwoWeekLow: YahooNumber,
    fiftyTwoWeekHigh: YahooNumber,
    shortName: Type.String(),
    averageAnalystRating: Type.Optional(Type.String()),
    regularMarketChangePercent: YahooNumber,
    symbol: Type.String(),
    dividendDate: Type.Optional(YahooFinanceDate),
    displayName: Type.Optional(Type.String()),
    trailingPE: Type.Optional(YahooNumber),
    prevName: Type.Optional(Type.String()),
    nameChangeDate: Type.Optional(YahooFinanceDate),
    ipoExpectedDate: Type.Optional(YahooFinanceDate),
    dividendYield: Type.Optional(YahooNumber),
    dividendRate: Type.Optional(YahooNumber),
    yieldTTM: Type.Optional(YahooNumber),
    peTTM: Type.Optional(YahooNumber),
    annualReturnNavY3: Type.Optional(YahooNumber),
    annualReturnNavY5: Type.Optional(YahooNumber),
    ytdReturn: Type.Optional(YahooNumber),
    trailingThreeMonthReturns: Type.Optional(YahooNumber),
    netAssets: Type.Optional(YahooNumber),
    netExpenseRatio: Type.Optional(YahooNumber),
  },
  {
    title: 'ScreenerQuote',
  }
);
var ScreenerResult = Type.Object(
  {
    id: Type.String(),
    title: Type.String(),
    description: Type.String(),
    canonicalName: Type.String(),
    criteriaMeta: ScreenerCriteriaMeta,
    rawCriteria: Type.String(),
    start: YahooNumber,
    count: YahooNumber,
    total: YahooNumber,
    quotes: Type.Array(ScreenerQuote),
    useRecords: Type.Boolean(),
    predefinedScr: Type.Boolean(),
    versionId: YahooNumber,
    creationDate: YahooFinanceDate,
    lastUpdated: YahooFinanceDate,
    isPremium: Type.Boolean(),
    iconUrl: Type.String(),
  },
  {
    title: 'ScreenerResult',
  }
);
var PredefinedScreenerModules = Type.Union(
  [
    Type.Literal('aggressive_small_caps'),
    Type.Literal('conservative_foreign_funds'),
    Type.Literal('day_gainers'),
    Type.Literal('day_losers'),
    Type.Literal('growth_technology_stocks'),
    Type.Literal('high_yield_bond'),
    Type.Literal('most_actives'),
    Type.Literal('most_shorted_stocks'),
    Type.Literal('portfolio_anchors'),
    Type.Literal('small_cap_gainers'),
    Type.Literal('solid_large_growth_funds'),
    Type.Literal('solid_midcap_growth_funds'),
    Type.Literal('top_mutual_funds'),
    Type.Literal('undervalued_growth_stocks'),
    Type.Literal('undervalued_large_caps'),
  ],
  {
    title: 'ScreenerPredefinedScreenerModules',
  }
);
var queryOptionsDefaults12 = {
  lang: 'en-US',
  region: 'US',
  scrIds: 'day_gainers',
  count: 5,
};
var ScreenerOptions = Type.Object({
  lang: Type.Optional(Type.String()),
  region: Type.Optional(Type.String()),
  scrIds: PredefinedScreenerModules,
  count: Type.Optional(Type.Number()),
});
function screener(queryOptionsOverrides, moduleOptions) {
  return this._moduleExec({
    moduleName: 'screener',
    query: {
      url: 'https://${YF_QUERY_HOST}/v1/finance/screener/predefined/saved',
      schema: ScreenerOptions,
      defaults: queryOptionsDefaults12,
      overrides: queryOptionsOverrides,
      needsCrumb: true,
    },
    result: {
      schema: ScreenerResult,
      transformWith(result) {
        if (!result.finance)
          throw new Error('Unexpected result: ' + JSON.stringify(result));
        return result.finance.result[0];
      },
    },
    moduleOptions,
  });
}
__name(screener, 'screener');

// node_modules/yahoo-finance2/dist/esm/src/other/quoteCombine.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var DEBOUNCE_TIME = 50;
var slugMap = /* @__PURE__ */ new Map();
function quoteCombine(query, queryOptionsOverrides = {}, moduleOptions) {
  const symbol = query;
  if (typeof symbol !== 'string')
    throw new Error(
      'quoteCombine expects a string query parameter, received: ' +
        JSON.stringify(symbol, null, 2)
    );
  validateAndCoerceTypebox({
    type: 'options',
    data: queryOptionsOverrides,
    schema: QuoteOptionsSchema,
    options: this._opts.validation,
  });
  const slug = JSON.stringify(queryOptionsOverrides);
  let entry = slugMap.get(slug);
  if (!entry) {
    entry = {
      timeout: null,
      queryOptionsOverrides,
      symbols: /* @__PURE__ */ new Map(),
    };
    slugMap.set(slug, entry);
  }
  if (entry.timeout) clearTimeout(entry.timeout);
  const thisQuote = quote.bind(this);
  return new Promise((resolve, reject) => {
    let symbolPromiseCallbacks = entry.symbols.get(symbol);
    if (!symbolPromiseCallbacks) {
      symbolPromiseCallbacks = [];
      entry.symbols.set(symbol, symbolPromiseCallbacks);
    }
    symbolPromiseCallbacks.push({ resolve, reject });
    entry.timeout = setTimeout(() => {
      slugMap.delete(slug);
      const symbols = Array.from(entry.symbols.keys());
      thisQuote(symbols, queryOptionsOverrides, moduleOptions)
        .then((results) => {
          for (const result of results) {
            for (const promise2 of entry.symbols.get(result.symbol)) {
              promise2.resolve(result);
              promise2.resolved = true;
            }
          }
          for (const [_, promises] of entry.symbols) {
            for (const promise2 of promises) {
              if (!promise2.resolved) {
                promise2.resolve(void 0);
              }
            }
          }
        })
        .catch((error3) => {
          for (const symbolPromiseCallbacks2 of entry.symbols.values())
            for (const promise2 of symbolPromiseCallbacks2)
              promise2.reject(error3);
        });
    }, DEBOUNCE_TIME);
  });
}
__name(quoteCombine, 'quoteCombine');

// node_modules/yahoo-finance2/dist/esm/src/index-common.js
console.warn(
  '[yahoo-finance2] v2 is no longer maintained nor supported.  Please migrate to v3. See https://github.com/gadicc/yahoo-finance2/blob/dev/docs/UPGRADING.md for details.'
);
var index_common_default = {
  // internal
  _env: {},
  _fetch: yahooFinanceFetch_default,
  _moduleExec: moduleExec_default,
  _opts: options_default,
  // common
  errors: errors_default,
  setGlobalConfig,
  suppressNotices,
  // modules,
  autoc,
  chart,
  _chart,
  historical,
  insights: trendingSymbols,
  options: options2,
  quote,
  quoteSummary,
  fundamentalsTimeSeries,
  recommendationsBySymbol,
  search,
  trendingSymbols: trendingSymbols2,
  dailyGainers,
  screener,
  // other
  quoteCombine,
};

// node_modules/yahoo-finance2/dist/esm/src/env-node.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import { URLSearchParams } from 'url';
var env_node_default = {
  fetch,
  URLSearchParams,
};

// node_modules/yahoo-finance2/dist/esm/src/index-node.js
index_common_default._env = env_node_default;
var index_node_default = index_common_default;

// src/index.ts
var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
__name(jsonResponse, 'jsonResponse');
async function handleQuote(ticker) {
  try {
    console.log(`[Yahoo Proxy] Fetching quote for ${ticker}`);
    const quote2 = await index_node_default.quote(ticker.toUpperCase());
    return jsonResponse({
      quoteResponse: {
        result: [quote2],
        error: null,
      },
    });
  } catch (error3) {
    console.error(`[Yahoo Proxy] Quote error:`, error3);
    return jsonResponse({
      quoteResponse: {
        result: [],
        error: {
          code: 'Error',
          description: String(error3),
        },
      },
    });
  }
}
__name(handleQuote, 'handleQuote');
async function handleChart(ticker, searchParams) {
  try {
    const period1 = searchParams.get('period1');
    const period2 = searchParams.get('period2');
    const interval = searchParams.get('interval') || '1d';
    let queryOptions;
    if (period1) {
      queryOptions = {
        period1: new Date(parseInt(period1) * 1e3),
        period2: period2
          ? new Date(parseInt(period2) * 1e3)
          : /* @__PURE__ */ new Date(),
        interval,
      };
    } else {
      const range = searchParams.get('range') || '1mo';
      queryOptions = {
        period1: getStartDate(range),
        period2: /* @__PURE__ */ new Date(),
        interval,
      };
    }
    console.log(`[Yahoo Proxy] Fetching chart for ${ticker}`);
    const chart2 = await index_node_default.chart(
      ticker.toUpperCase(),
      queryOptions
    );
    return jsonResponse({
      chart: {
        result: [chart2],
        error: null,
      },
    });
  } catch (error3) {
    console.error(`[Yahoo Proxy] Chart error:`, error3);
    return jsonResponse({
      chart: {
        result: [],
        error: {
          code: 'Error',
          description: String(error3),
        },
      },
    });
  }
}
__name(handleChart, 'handleChart');
function getStartDate(range) {
  const now = /* @__PURE__ */ new Date();
  switch (range) {
    case '1d':
      return new Date(now.setDate(now.getDate() - 1));
    case '5d':
      return new Date(now.setDate(now.getDate() - 5));
    case '1mo':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3mo':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '6mo':
      return new Date(now.setMonth(now.getMonth() - 6));
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case '2y':
      return new Date(now.setFullYear(now.getFullYear() - 2));
    case '5y':
      return new Date(now.setFullYear(now.getFullYear() - 5));
    default:
      return new Date(now.setMonth(now.getMonth() - 1));
  }
}
__name(getStartDate, 'getStartDate');
async function handleOptions(ticker, searchParams) {
  try {
    const dateParam = searchParams.get('date');
    console.log(`[Yahoo Proxy] Fetching options for ${ticker}`);
    const options3 = await index_node_default.options(
      ticker.toUpperCase(),
      dateParam ? { date: new Date(parseInt(dateParam) * 1e3) } : void 0
    );
    return jsonResponse({
      optionChain: {
        result: [options3],
        error: null,
      },
    });
  } catch (error3) {
    console.error(`[Yahoo Proxy] Options error:`, error3);
    return jsonResponse({
      optionChain: {
        result: [],
        error: {
          code: 'Error',
          description: String(error3),
        },
      },
    });
  }
}
__name(handleOptions, 'handleOptions');
async function handleSummary(ticker, searchParams) {
  try {
    const modulesParam = searchParams.get('modules');
    const modules = modulesParam
      ? modulesParam.split(',')
      : [
          'price',
          'summaryDetail',
          'summaryProfile',
          'financialData',
          'recommendationTrend',
          'earningsHistory',
          'earningsTrend',
          'defaultKeyStatistics',
          'calendarEvents',
          'incomeStatementHistory',
          'balanceSheetHistory',
          'cashflowStatementHistory',
          'institutionOwnership',
          'majorHoldersBreakdown',
        ];
    console.log(`[Yahoo Proxy] Fetching summary for ${ticker}`);
    const summary = await index_node_default.quoteSummary(
      ticker.toUpperCase(),
      { modules }
    );
    return jsonResponse({
      quoteSummary: {
        result: [summary],
        error: null,
      },
    });
  } catch (error3) {
    console.error(`[Yahoo Proxy] Summary error:`, error3);
    return jsonResponse({
      quoteSummary: {
        result: [],
        error: {
          code: 'Error',
          description: String(error3),
        },
      },
    });
  }
}
__name(handleSummary, 'handleSummary');
async function handleSearch(searchParams) {
  const query = searchParams.get('q');
  const newsCount = parseInt(searchParams.get('newsCount') || '5');
  if (!query) {
    return jsonResponse({ error: 'Missing query parameter' }, 400);
  }
  try {
    console.log(`[Yahoo Proxy] Searching for ${query}`);
    const results = await index_node_default.search(query, {
      newsCount,
      quotesCount: 5,
    });
    return jsonResponse(results);
  } catch (error3) {
    console.error(`[Yahoo Proxy] Search error:`, error3);
    return jsonResponse({
      error: 'Search failed',
      details: String(error3),
    });
  }
}
__name(handleSearch, 'handleSearch');
var src_default = {
  async fetch(request, env2, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams;
    try {
      if (path === '/health' || path === '/') {
        return jsonResponse({
          status: 'ok',
          service: 'yahoo-proxy',
          timestamp: /* @__PURE__ */ new Date().toISOString(),
        });
      }
      const quoteMatch = path.match(/^\/quote\/([A-Z0-9.-]+)$/i);
      if (quoteMatch) {
        return handleQuote(quoteMatch[1]);
      }
      const chartMatch = path.match(/^\/chart\/([A-Z0-9.-]+)$/i);
      if (chartMatch) {
        return handleChart(chartMatch[1], searchParams);
      }
      const optionsMatch = path.match(/^\/options\/([A-Z0-9.-]+)$/i);
      if (optionsMatch) {
        return handleOptions(optionsMatch[1], searchParams);
      }
      const summaryMatch = path.match(/^\/summary\/([A-Z0-9.-]+)$/i);
      if (summaryMatch) {
        return handleSummary(summaryMatch[1], searchParams);
      }
      if (path === '/search') {
        return handleSearch(searchParams);
      }
      return jsonResponse(
        {
          error: 'Not found',
          available_endpoints: [
            'GET /quote/:ticker',
            'GET /chart/:ticker?range=1mo&interval=1d',
            'GET /options/:ticker?date=UNIX_TIMESTAMP',
            'GET /summary/:ticker?modules=price,summaryDetail,...',
            'GET /search?q=TICKER&newsCount=5',
            'GET /health',
          ],
        },
        404
      );
    } catch (error3) {
      console.error('[Yahoo Proxy] Unexpected error:', error3);
      return jsonResponse(
        {
          error: 'Internal server error',
          details: String(error3),
        },
        500
      );
    }
  },
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var drainBody = /* @__PURE__ */ __name(
  async (request, env2, _ctx, middlewareCtx) => {
    try {
      return await middlewareCtx.next(request, env2);
    } finally {
      try {
        if (request.body !== null && !request.bodyUsed) {
          const reader = request.body.getReader();
          while (!(await reader.read()).done) {}
        }
      } catch (e) {
        console.error('Failed to drain the unused request body.', e);
      }
    }
  },
  'drainBody'
);
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause),
  };
}
__name(reduceError, 'reduceError');
var jsonError = /* @__PURE__ */ __name(
  async (request, env2, _ctx, middlewareCtx) => {
    try {
      return await middlewareCtx.next(request, env2);
    } catch (e) {
      const error3 = reduceError(e);
      return Response.json(error3, {
        status: 500,
        headers: { 'MF-Experimental-Error-Stack': 'true' },
      });
    }
  },
  'jsonError'
);
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-SOyyoz/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default,
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, '__facade_register__');
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    },
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, '__facade_invokeChain__');
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware,
  ]);
}
__name(__facade_invoke__, '__facade_invoke__');

// .wrangler/tmp/bundle-SOyyoz/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, '__Facade_ScheduledController__');
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError('Illegal invocation');
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (
    __INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 ||
    __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0
  ) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function (request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error('Handler does not export a fetch() function.');
    }
    return worker.fetch(request, env2, ctx);
  }, 'fetchDispatcher');
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function (type, init) {
        if (type === 'scheduled' && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? '',
            () => {}
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, 'dispatcher');
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    },
  };
}
__name(wrapExportedHandler, 'wrapExportedHandler');
function wrapWorkerEntrypoint(klass) {
  if (
    __INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 ||
    __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0
  ) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error('Entrypoint class does not define a fetch() function.');
      }
      return super.fetch(request);
    }, '#fetchDispatcher');
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === 'scheduled' && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? '',
          () => {}
        );
        return super.scheduled(controller);
      }
    }, '#dispatcher');
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, 'wrapWorkerEntrypoint');
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === 'object') {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === 'function') {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default,
};
/*! Bundled license information:

tough-cookie/lib/pubsuffix-psl.js:
  (*!
   * Copyright (c) 2018, Salesforce.com, Inc.
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   * this list of conditions and the following disclaimer.
   *
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   * this list of conditions and the following disclaimer in the documentation
   * and/or other materials provided with the distribution.
   *
   * 3. Neither the name of Salesforce.com nor the names of its contributors may
   * be used to endorse or promote products derived from this software without
   * specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   *)

tough-cookie/lib/store.js:
tough-cookie/lib/permuteDomain.js:
tough-cookie/lib/pathMatch.js:
tough-cookie/lib/memstore.js:
  (*!
   * Copyright (c) 2015, Salesforce.com, Inc.
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   * this list of conditions and the following disclaimer.
   *
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   * this list of conditions and the following disclaimer in the documentation
   * and/or other materials provided with the distribution.
   *
   * 3. Neither the name of Salesforce.com nor the names of its contributors may
   * be used to endorse or promote products derived from this software without
   * specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   *)

tough-cookie/lib/cookie.js:
  (*!
   * Copyright (c) 2015-2020, Salesforce.com, Inc.
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   * this list of conditions and the following disclaimer.
   *
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   * this list of conditions and the following disclaimer in the documentation
   * and/or other materials provided with the distribution.
   *
   * 3. Neither the name of Salesforce.com nor the names of its contributors may
   * be used to endorse or promote products derived from this software without
   * specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   *)
*/
//# sourceMappingURL=index.js.map
