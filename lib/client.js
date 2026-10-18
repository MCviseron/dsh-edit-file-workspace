window.__ModuleLoader__.load({
  id: "dsh-edit-file-workspace",
  factory: (require) => {
"use strict";

    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/EditFileWorkspaceCard.tsx
var import_react = require("react");

// node_modules/.pnpm/zustand@4.4.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/vanilla.mjs
var import_meta = {};
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const destroy = () => {
    if ((import_meta.env ? import_meta.env.MODE : void 0) !== "production") {
      console.warn(
        "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
      );
    }
    listeners.clear();
  };
  const api = { setState, getState, subscribe, destroy };
  state = createState(setState, getState, api);
  return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

// node_modules/.pnpm/zustand@4.4.7_@types+react@18.3.31_immer@10.2.0_react@18.3.1/node_modules/zustand/esm/middleware.mjs
var subscribeWithSelectorImpl = (fn) => (set2, get, api) => {
  const origSubscribe = api.subscribe;
  api.subscribe = (selector, optListener, options) => {
    let listener = selector;
    if (optListener) {
      const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
      let currentSlice = selector(api.getState());
      listener = (state) => {
        const nextSlice = selector(state);
        if (!equalityFn(currentSlice, nextSlice)) {
          const previousSlice = currentSlice;
          optListener(currentSlice = nextSlice, previousSlice);
        }
      };
      if (options == null ? void 0 : options.fireImmediately) {
        optListener(currentSlice, currentSlice);
      }
    }
    return origSubscribe(listener);
  };
  const initialState = fn(set2, get, api);
  return initialState;
};
var subscribeWithSelector = subscribeWithSelectorImpl;

// node_modules/.pnpm/immer@10.2.0/node_modules/immer/dist/immer.mjs
var NOTHING = Symbol.for("immer-nothing");
var DRAFTABLE = Symbol.for("immer-draftable");
var DRAFT_STATE = Symbol.for("immer-state");
var errors = true ? [
  // All error codes, starting by 0:
  function(plugin) {
    return `The plugin for '${plugin}' has not been loaded into Immer. To enable the plugin, import and call \`enable${plugin}()\` when initializing your application.`;
  },
  function(thing) {
    return `produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${thing}'`;
  },
  "This object has been frozen and should not be mutated",
  function(data) {
    return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " + data;
  },
  "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.",
  "Immer forbids circular references",
  "The first or second argument to `produce` must be a function",
  "The third argument to `produce` must be a function or undefined",
  "First argument to `createDraft` must be a plain object, an array, or an immerable object",
  "First argument to `finishDraft` must be a draft returned by `createDraft`",
  function(thing) {
    return `'current' expects a draft, got: ${thing}`;
  },
  "Object.defineProperty() cannot be used on an Immer draft",
  "Object.setPrototypeOf() cannot be used on an Immer draft",
  "Immer only supports deleting array indices",
  "Immer only supports setting array indices and the 'length' property",
  function(thing) {
    return `'original' expects a draft, got: ${thing}`;
  }
  // Note: if more errors are added, the errorOffset in Patches.ts should be increased
  // See Patches.ts for additional errors
] : [];
function die(error, ...args) {
  if (true) {
    const e = errors[error];
    const msg = typeof e === "function" ? e.apply(null, args) : e;
    throw new Error(`[Immer] ${msg}`);
  }
  throw new Error(
    `[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`
  );
}
var getPrototypeOf = Object.getPrototypeOf;
function isDraft(value) {
  return !!value && !!value[DRAFT_STATE];
}
function isDraftable(value) {
  if (!value)
    return false;
  return isPlainObject(value) || Array.isArray(value) || !!value[DRAFTABLE] || !!value.constructor?.[DRAFTABLE] || isMap(value) || isSet(value);
}
var objectCtorString = Object.prototype.constructor.toString();
var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
function isPlainObject(value) {
  if (!value || typeof value !== "object")
    return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null || proto === Object.prototype)
    return true;
  const Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  if (Ctor === Object)
    return true;
  if (typeof Ctor !== "function")
    return false;
  let ctorString = cachedCtorStrings.get(Ctor);
  if (ctorString === void 0) {
    ctorString = Function.toString.call(Ctor);
    cachedCtorStrings.set(Ctor, ctorString);
  }
  return ctorString === objectCtorString;
}
function each(obj, iter, strict = true) {
  if (getArchtype(obj) === 0) {
    const keys = strict ? Reflect.ownKeys(obj) : Object.keys(obj);
    keys.forEach((key) => {
      iter(key, obj[key], obj);
    });
  } else {
    obj.forEach((entry, index) => iter(index, entry, obj));
  }
}
function getArchtype(thing) {
  const state = thing[DRAFT_STATE];
  return state ? state.type_ : Array.isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
}
function has(thing, prop) {
  return getArchtype(thing) === 2 ? thing.has(prop) : Object.prototype.hasOwnProperty.call(thing, prop);
}
function set(thing, propOrOldValue, value) {
  const t = getArchtype(thing);
  if (t === 2)
    thing.set(propOrOldValue, value);
  else if (t === 3) {
    thing.add(value);
  } else
    thing[propOrOldValue] = value;
}
function is(x, y) {
  if (x === y) {
    return x !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
function isMap(target) {
  return target instanceof Map;
}
function isSet(target) {
  return target instanceof Set;
}
function latest(state) {
  return state.copy_ || state.base_;
}
function shallowCopy(base, strict) {
  if (isMap(base)) {
    return new Map(base);
  }
  if (isSet(base)) {
    return new Set(base);
  }
  if (Array.isArray(base))
    return Array.prototype.slice.call(base);
  const isPlain = isPlainObject(base);
  if (strict === true || strict === "class_only" && !isPlain) {
    const descriptors = Object.getOwnPropertyDescriptors(base);
    delete descriptors[DRAFT_STATE];
    let keys = Reflect.ownKeys(descriptors);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = descriptors[key];
      if (desc.writable === false) {
        desc.writable = true;
        desc.configurable = true;
      }
      if (desc.get || desc.set)
        descriptors[key] = {
          configurable: true,
          writable: true,
          // could live with !!desc.set as well here...
          enumerable: desc.enumerable,
          value: base[key]
        };
    }
    return Object.create(getPrototypeOf(base), descriptors);
  } else {
    const proto = getPrototypeOf(base);
    if (proto !== null && isPlain) {
      return { ...base };
    }
    const obj = Object.create(proto);
    return Object.assign(obj, base);
  }
}
function freeze(obj, deep = false) {
  if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
    return obj;
  if (getArchtype(obj) > 1) {
    Object.defineProperties(obj, {
      set: dontMutateMethodOverride,
      add: dontMutateMethodOverride,
      clear: dontMutateMethodOverride,
      delete: dontMutateMethodOverride
    });
  }
  Object.freeze(obj);
  if (deep)
    Object.values(obj).forEach((value) => freeze(value, true));
  return obj;
}
function dontMutateFrozenCollections() {
  die(2);
}
var dontMutateMethodOverride = {
  value: dontMutateFrozenCollections
};
function isFrozen(obj) {
  if (obj === null || typeof obj !== "object")
    return true;
  return Object.isFrozen(obj);
}
var plugins = {};
function getPlugin(pluginKey) {
  const plugin = plugins[pluginKey];
  if (!plugin) {
    die(0, pluginKey);
  }
  return plugin;
}
var currentScope;
function getCurrentScope() {
  return currentScope;
}
function createScope(parent_, immer_) {
  return {
    drafts_: [],
    parent_,
    immer_,
    // Whenever the modified draft contains a draft from another scope, we
    // need to prevent auto-freezing so the unowned draft can be finalized.
    canAutoFreeze_: true,
    unfinalizedDrafts_: 0
  };
}
function usePatchesInScope(scope, patchListener) {
  if (patchListener) {
    getPlugin("Patches");
    scope.patches_ = [];
    scope.inversePatches_ = [];
    scope.patchListener_ = patchListener;
  }
}
function revokeScope(scope) {
  leaveScope(scope);
  scope.drafts_.forEach(revokeDraft);
  scope.drafts_ = null;
}
function leaveScope(scope) {
  if (scope === currentScope) {
    currentScope = scope.parent_;
  }
}
function enterScope(immer2) {
  return currentScope = createScope(currentScope, immer2);
}
function revokeDraft(draft) {
  const state = draft[DRAFT_STATE];
  if (state.type_ === 0 || state.type_ === 1)
    state.revoke_();
  else
    state.revoked_ = true;
}
function processResult(result, scope) {
  scope.unfinalizedDrafts_ = scope.drafts_.length;
  const baseDraft = scope.drafts_[0];
  const isReplaced = result !== void 0 && result !== baseDraft;
  if (isReplaced) {
    if (baseDraft[DRAFT_STATE].modified_) {
      revokeScope(scope);
      die(4);
    }
    if (isDraftable(result)) {
      result = finalize(scope, result);
      if (!scope.parent_)
        maybeFreeze(scope, result);
    }
    if (scope.patches_) {
      getPlugin("Patches").generateReplacementPatches_(
        baseDraft[DRAFT_STATE].base_,
        result,
        scope.patches_,
        scope.inversePatches_
      );
    }
  } else {
    result = finalize(scope, baseDraft, []);
  }
  revokeScope(scope);
  if (scope.patches_) {
    scope.patchListener_(scope.patches_, scope.inversePatches_);
  }
  return result !== NOTHING ? result : void 0;
}
function finalize(rootScope, value, path) {
  if (isFrozen(value))
    return value;
  const useStrictIteration = rootScope.immer_.shouldUseStrictIteration();
  const state = value[DRAFT_STATE];
  if (!state) {
    each(
      value,
      (key, childValue) => finalizeProperty(rootScope, state, value, key, childValue, path),
      useStrictIteration
    );
    return value;
  }
  if (state.scope_ !== rootScope)
    return value;
  if (!state.modified_) {
    maybeFreeze(rootScope, state.base_, true);
    return state.base_;
  }
  if (!state.finalized_) {
    state.finalized_ = true;
    state.scope_.unfinalizedDrafts_--;
    const result = state.copy_;
    let resultEach = result;
    let isSet2 = false;
    if (state.type_ === 3) {
      resultEach = new Set(result);
      result.clear();
      isSet2 = true;
    }
    each(
      resultEach,
      (key, childValue) => finalizeProperty(
        rootScope,
        state,
        result,
        key,
        childValue,
        path,
        isSet2
      ),
      useStrictIteration
    );
    maybeFreeze(rootScope, result, false);
    if (path && rootScope.patches_) {
      getPlugin("Patches").generatePatches_(
        state,
        path,
        rootScope.patches_,
        rootScope.inversePatches_
      );
    }
  }
  return state.copy_;
}
function finalizeProperty(rootScope, parentState, targetObject, prop, childValue, rootPath, targetIsSet) {
  if (childValue == null) {
    return;
  }
  if (typeof childValue !== "object" && !targetIsSet) {
    return;
  }
  const childIsFrozen = isFrozen(childValue);
  if (childIsFrozen && !targetIsSet) {
    return;
  }
  if (childValue === targetObject)
    die(5);
  if (isDraft(childValue)) {
    const path = rootPath && parentState && parentState.type_ !== 3 && // Set objects are atomic since they have no keys.
    !has(parentState.assigned_, prop) ? rootPath.concat(prop) : void 0;
    const res = finalize(rootScope, childValue, path);
    set(targetObject, prop, res);
    if (isDraft(res)) {
      rootScope.canAutoFreeze_ = false;
    } else
      return;
  } else if (targetIsSet) {
    targetObject.add(childValue);
  }
  if (isDraftable(childValue) && !childIsFrozen) {
    if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
      return;
    }
    if (parentState && parentState.base_ && parentState.base_[prop] === childValue && childIsFrozen) {
      return;
    }
    finalize(rootScope, childValue);
    if ((!parentState || !parentState.scope_.parent_) && typeof prop !== "symbol" && (isMap(targetObject) ? targetObject.has(prop) : Object.prototype.propertyIsEnumerable.call(targetObject, prop)))
      maybeFreeze(rootScope, childValue);
  }
}
function maybeFreeze(scope, value, deep = false) {
  if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
    freeze(value, deep);
  }
}
function createProxyProxy(base, parent) {
  const isArray = Array.isArray(base);
  const state = {
    type_: isArray ? 1 : 0,
    // Track which produce call this is associated with.
    scope_: parent ? parent.scope_ : getCurrentScope(),
    // True for both shallow and deep changes.
    modified_: false,
    // Used during finalization.
    finalized_: false,
    // Track which properties have been assigned (true) or deleted (false).
    assigned_: {},
    // The parent draft state.
    parent_: parent,
    // The base state.
    base_: base,
    // The base proxy.
    draft_: null,
    // set below
    // The base copy with any updated values.
    copy_: null,
    // Called by the `produce` function.
    revoke_: null,
    isManual_: false
  };
  let target = state;
  let traps = objectTraps;
  if (isArray) {
    target = [state];
    traps = arrayTraps;
  }
  const { revoke, proxy } = Proxy.revocable(target, traps);
  state.draft_ = proxy;
  state.revoke_ = revoke;
  return proxy;
}
var objectTraps = {
  get(state, prop) {
    if (prop === DRAFT_STATE)
      return state;
    const source = latest(state);
    if (!has(source, prop)) {
      return readPropFromProto(state, source, prop);
    }
    const value = source[prop];
    if (state.finalized_ || !isDraftable(value)) {
      return value;
    }
    if (value === peek(state.base_, prop)) {
      prepareCopy(state);
      return state.copy_[prop] = createProxy(value, state);
    }
    return value;
  },
  has(state, prop) {
    return prop in latest(state);
  },
  ownKeys(state) {
    return Reflect.ownKeys(latest(state));
  },
  set(state, prop, value) {
    const desc = getDescriptorFromProto(latest(state), prop);
    if (desc?.set) {
      desc.set.call(state.draft_, value);
      return true;
    }
    if (!state.modified_) {
      const current2 = peek(latest(state), prop);
      const currentState = current2?.[DRAFT_STATE];
      if (currentState && currentState.base_ === value) {
        state.copy_[prop] = value;
        state.assigned_[prop] = false;
        return true;
      }
      if (is(value, current2) && (value !== void 0 || has(state.base_, prop)))
        return true;
      prepareCopy(state);
      markChanged(state);
    }
    if (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
    (value !== void 0 || prop in state.copy_) || // special case: NaN
    Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
      return true;
    state.copy_[prop] = value;
    state.assigned_[prop] = true;
    return true;
  },
  deleteProperty(state, prop) {
    if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
      state.assigned_[prop] = false;
      prepareCopy(state);
      markChanged(state);
    } else {
      delete state.assigned_[prop];
    }
    if (state.copy_) {
      delete state.copy_[prop];
    }
    return true;
  },
  // Note: We never coerce `desc.value` into an Immer draft, because we can't make
  // the same guarantee in ES5 mode.
  getOwnPropertyDescriptor(state, prop) {
    const owner = latest(state);
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
    if (!desc)
      return desc;
    return {
      writable: true,
      configurable: state.type_ !== 1 || prop !== "length",
      enumerable: desc.enumerable,
      value: owner[prop]
    };
  },
  defineProperty() {
    die(11);
  },
  getPrototypeOf(state) {
    return getPrototypeOf(state.base_);
  },
  setPrototypeOf() {
    die(12);
  }
};
var arrayTraps = {};
each(objectTraps, (key, fn) => {
  arrayTraps[key] = function() {
    arguments[0] = arguments[0][0];
    return fn.apply(this, arguments);
  };
});
arrayTraps.deleteProperty = function(state, prop) {
  if (isNaN(parseInt(prop)))
    die(13);
  return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function(state, prop, value) {
  if (prop !== "length" && isNaN(parseInt(prop)))
    die(14);
  return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft, prop) {
  const state = draft[DRAFT_STATE];
  const source = state ? latest(state) : draft;
  return source[prop];
}
function readPropFromProto(state, source, prop) {
  const desc = getDescriptorFromProto(source, prop);
  return desc ? `value` in desc ? desc.value : (
    // This is a very special case, if the prop is a getter defined by the
    // prototype, we should invoke it with the draft as context!
    desc.get?.call(state.draft_)
  ) : void 0;
}
function getDescriptorFromProto(source, prop) {
  if (!(prop in source))
    return void 0;
  let proto = getPrototypeOf(source);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc)
      return desc;
    proto = getPrototypeOf(proto);
  }
  return void 0;
}
function markChanged(state) {
  if (!state.modified_) {
    state.modified_ = true;
    if (state.parent_) {
      markChanged(state.parent_);
    }
  }
}
function prepareCopy(state) {
  if (!state.copy_) {
    state.copy_ = shallowCopy(
      state.base_,
      state.scope_.immer_.useStrictShallowCopy_
    );
  }
}
var Immer2 = class {
  constructor(config) {
    this.autoFreeze_ = true;
    this.useStrictShallowCopy_ = false;
    this.useStrictIteration_ = true;
    this.produce = (base, recipe, patchListener) => {
      if (typeof base === "function" && typeof recipe !== "function") {
        const defaultBase = recipe;
        recipe = base;
        const self = this;
        return function curriedProduce(base2 = defaultBase, ...args) {
          return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
        };
      }
      if (typeof recipe !== "function")
        die(6);
      if (patchListener !== void 0 && typeof patchListener !== "function")
        die(7);
      let result;
      if (isDraftable(base)) {
        const scope = enterScope(this);
        const proxy = createProxy(base, void 0);
        let hasError = true;
        try {
          result = recipe(proxy);
          hasError = false;
        } finally {
          if (hasError)
            revokeScope(scope);
          else
            leaveScope(scope);
        }
        usePatchesInScope(scope, patchListener);
        return processResult(result, scope);
      } else if (!base || typeof base !== "object") {
        result = recipe(base);
        if (result === void 0)
          result = base;
        if (result === NOTHING)
          result = void 0;
        if (this.autoFreeze_)
          freeze(result, true);
        if (patchListener) {
          const p = [];
          const ip = [];
          getPlugin("Patches").generateReplacementPatches_(base, result, p, ip);
          patchListener(p, ip);
        }
        return result;
      } else
        die(1, base);
    };
    this.produceWithPatches = (base, recipe) => {
      if (typeof base === "function") {
        return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
      }
      let patches, inversePatches;
      const result = this.produce(base, recipe, (p, ip) => {
        patches = p;
        inversePatches = ip;
      });
      return [result, patches, inversePatches];
    };
    if (typeof config?.autoFreeze === "boolean")
      this.setAutoFreeze(config.autoFreeze);
    if (typeof config?.useStrictShallowCopy === "boolean")
      this.setUseStrictShallowCopy(config.useStrictShallowCopy);
    if (typeof config?.useStrictIteration === "boolean")
      this.setUseStrictIteration(config.useStrictIteration);
  }
  createDraft(base) {
    if (!isDraftable(base))
      die(8);
    if (isDraft(base))
      base = current(base);
    const scope = enterScope(this);
    const proxy = createProxy(base, void 0);
    proxy[DRAFT_STATE].isManual_ = true;
    leaveScope(scope);
    return proxy;
  }
  finishDraft(draft, patchListener) {
    const state = draft && draft[DRAFT_STATE];
    if (!state || !state.isManual_)
      die(9);
    const { scope_: scope } = state;
    usePatchesInScope(scope, patchListener);
    return processResult(void 0, scope);
  }
  /**
   * Pass true to automatically freeze all copies created by Immer.
   *
   * By default, auto-freezing is enabled.
   */
  setAutoFreeze(value) {
    this.autoFreeze_ = value;
  }
  /**
   * Pass true to enable strict shallow copy.
   *
   * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
   */
  setUseStrictShallowCopy(value) {
    this.useStrictShallowCopy_ = value;
  }
  /**
   * Pass false to use faster iteration that skips non-enumerable properties
   * but still handles symbols for compatibility.
   *
   * By default, strict iteration is enabled (includes all own properties).
   */
  setUseStrictIteration(value) {
    this.useStrictIteration_ = value;
  }
  shouldUseStrictIteration() {
    return this.useStrictIteration_;
  }
  applyPatches(base, patches) {
    let i;
    for (i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      if (patch.path.length === 0 && patch.op === "replace") {
        base = patch.value;
        break;
      }
    }
    if (i > -1) {
      patches = patches.slice(i + 1);
    }
    const applyPatchesImpl = getPlugin("Patches").applyPatches_;
    if (isDraft(base)) {
      return applyPatchesImpl(base, patches);
    }
    return this.produce(
      base,
      (draft) => applyPatchesImpl(draft, patches)
    );
  }
};
function createProxy(value, parent) {
  const draft = isMap(value) ? getPlugin("MapSet").proxyMap_(value, parent) : isSet(value) ? getPlugin("MapSet").proxySet_(value, parent) : createProxyProxy(value, parent);
  const scope = parent ? parent.scope_ : getCurrentScope();
  scope.drafts_.push(draft);
  return draft;
}
function current(value) {
  if (!isDraft(value))
    die(10, value);
  return currentImpl(value);
}
function currentImpl(value) {
  if (!isDraftable(value) || isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  let copy;
  let strict = true;
  if (state) {
    if (!state.modified_)
      return state.base_;
    state.finalized_ = true;
    copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
    strict = state.scope_.immer_.shouldUseStrictIteration();
  } else {
    copy = shallowCopy(value, true);
  }
  each(
    copy,
    (key, childValue) => {
      set(copy, key, currentImpl(childValue));
    },
    strict
  );
  if (state) {
    state.finalized_ = false;
  }
  return copy;
}
var immer = new Immer2();
var produce = immer.produce;

// node_modules/.pnpm/@deepseek-ai+dsh-client-sto_2b8599fccddc668d88064689d3297f08/node_modules/@deepseek-ai/dsh-client-store/lib/index.js
function notifySubscribers(listeners, label, ...args) {
  for (const listener of [...listeners]) try {
    listener(...args);
  } catch (error) {
    console.error(`${label} subscriber failed:`, error);
  }
}
function rafBatch(notify) {
  const schedule = typeof requestAnimationFrame === "function" ? (fn) => {
    requestAnimationFrame(() => {
      fn();
    });
  } : (fn) => {
    queueMicrotask(fn);
  };
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      notify();
    });
  };
}
function createSnapshotStore(init, opts) {
  const withSelector = subscribeWithSelector(() => init);
  const api = createStore()(withSelector);
  if (opts?.persist) attachPersistence(api, opts.persist.name);
  let subscribe = (fn) => api.subscribe(() => {
    notifySubscribers([fn], "[client-store]");
  });
  if (opts?.flush === "raf") {
    const listeners = /* @__PURE__ */ new Set();
    const flush = rafBatch(() => {
      notifySubscribers(listeners, "[client-store]");
    });
    api.subscribe(flush);
    subscribe = (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    };
  }
  return {
    getSnapshot: () => api.getState(),
    subscribe: (fn) => subscribe(fn),
    update: (mutator) => {
      api.setState(produce(api.getState(), (draft) => {
        mutator(draft);
      }), true);
    },
    set: (next) => {
      api.setState(devFreeze(next), true);
    }
  };
}
function attachPersistence(api, name) {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(name);
    if (raw !== null) api.setState(devFreeze(JSON.parse(raw)), true);
  } catch (error) {
    console.error(`snapshot store '${name}' rehydration failed:`, error);
  }
  api.subscribe((state) => {
    try {
      localStorage.setItem(name, JSON.stringify(state));
    } catch (error) {
      console.error(`snapshot store '${name}' persistence failed:`, error);
    }
  });
}
function devFreeze(value) {
  return freeze(value, true);
}

// src/client/EditFileWorkspaceCard.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var REPAIR_KEY = "__repair__";
var API = {
  describe: "/api/dsh-edit-file-workspace/describe",
  move: "/api/dsh-edit-file-workspace/move",
  repair: "/api/dsh-edit-file-workspace/repair"
};
var EditFileWorkspaceCardController = class {
  constructor(host) {
    this.host = host;
    void this.refresh();
  }
  store = createSnapshotStore({ status: "loading", workspaces: [], sessions: [] });
  async refresh() {
    try {
      const response = await fetch(API.describe, { method: "POST" });
      const body = await response.json();
      if (body.ok !== true || body.value === void 0) throw new Error(body.error ?? "describe failed");
      this.store.set({
        ...this.store.getSnapshot(),
        status: "ready",
        workspaces: body.value.workspaces,
        sessions: body.value.sessions
      });
    } catch {
      this.store.set({ status: "unavailable", workspaces: [], sessions: [] });
    }
  }
  /**
   * Ask the DSH Session list to re-pull its baseline so the sidebar shows the
   * new grouping (and the re-bound title/time) without a page reload.
   */
  async refreshSessionList() {
    const sessions = this.host?.get?.("sessions");
    if (typeof sessions?.refresh !== "function") return false;
    try {
      await sessions.refresh();
      return true;
    } catch {
      return false;
    }
  }
  async move(sessionId, workspaceId) {
    try {
      const response = await fetch(API.move, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, workspaceId })
      });
      const body = await response.json();
      if (body.ok !== true || body.value === void 0) throw new Error(body.error ?? "move failed");
      this.store.set({
        status: "ready",
        workspaces: body.value.workspaces,
        sessions: body.value.sessions,
        notice: { kind: "ok", text: "ok" },
        move: body.value.move
      });
      return await this.refreshSessionList() ? "refreshed" : "reload";
    } catch (error) {
      this.store.update((draft) => {
        draft.notice = { kind: "error", text: error instanceof Error ? error.message : String(error) };
      });
      await this.refresh().catch(() => {
      });
      return "refreshed";
    }
  }
  /**
   * Re-bind every cold session whose metadata cache no longer matches its header
   * (sessions moved by a build that did not re-checkpoint them). Logs are never
   * touched: only the derived cache row is rebuilt.
   */
  async repair() {
    try {
      const response = await fetch(API.repair, { method: "POST" });
      const body = await response.json();
      if (body.ok !== true || body.value === void 0) throw new Error(body.error ?? "repair failed");
      this.store.update((draft) => {
        draft.repair = body.value;
        draft.notice = void 0;
      });
      await this.refresh();
      await this.refreshSessionList();
    } catch (error) {
      this.store.update((draft) => {
        draft.notice = { kind: "error", text: error instanceof Error ? error.message : String(error) };
      });
    }
  }
  inject() {
    return {
      hooks: { editFileWorkspaceCard: this.store },
      refresh: async () => {
        await this.refresh();
      },
      move: async (sessionId, workspaceId) => this.move(sessionId, workspaceId),
      repair: async () => {
        await this.repair();
      }
    };
  }
  dispose() {
  }
};
var cardStyle = {
  listStyle: "none",
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  borderRadius: 12,
  color: "var(--dsw-alias-label-primary)"
};
var headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "14px 16px"
};
var titleStyle = {
  margin: 0,
  color: "var(--dsw-alias-label-primary)",
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4
};
var descriptionStyle = {
  margin: "4px 0 0",
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 13,
  lineHeight: 1.5
};
var bodyStyle = {
  borderTop: "1px solid var(--dsw-alias-border-l2)",
  margin: "0 16px",
  padding: "8px 0 12px"
};
var toolbarStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  padding: "10px 0"
};
var inputStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  color: "var(--dsw-alias-label-primary)",
  borderRadius: 8,
  padding: "0 12px",
  height: 34,
  fontSize: 13,
  lineHeight: 1.5,
  width: "100%",
  boxSizing: "border-box",
  font: "inherit"
};
var buttonStyle = {
  appearance: "none",
  font: "inherit",
  cursor: "pointer",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  padding: "6px 16px",
  fontSize: 13,
  lineHeight: 1.5,
  background: "transparent",
  color: "var(--dsw-alias-label-secondary)"
};
var rowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) 220px",
  gap: 10,
  alignItems: "center",
  padding: "8px 0",
  borderTop: "1px solid var(--dsw-alias-border-l1)"
};
var cellTitleStyle = {
  fontSize: 13,
  lineHeight: 1.4,
  color: "var(--dsw-alias-label-primary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var cellMutedStyle = {
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--dsw-alias-label-tertiary)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var selectStyle = {
  border: "1px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-alias-bg-layer-3)",
  color: "var(--dsw-alias-label-primary)",
  borderRadius: 8,
  height: 34,
  padding: "0 8px",
  fontSize: 13,
  font: "inherit"
};
var noticeStyle = {
  margin: "8px 0 0",
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-state-success-primary)"
};
function EditFileWorkspaceCard(props) {
  const { t } = props;
  const state = props.useEditFileWorkspaceCard((snapshot) => snapshot);
  const [filter, setFilter] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(null);
  const [localError, setLocalError] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    void props.refresh();
  }, []);
  if (state.status === "loading") return null;
  if (state.status === "unavailable") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: cardStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", { style: headerStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: titleStyle, children: t("settings.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: descriptionStyle, children: t("settings.unavailable") })
    ] }) }) });
  }
  const needle = filter.trim().toLowerCase();
  const sessions = state.sessions.filter((session) => {
    if (needle === "") return true;
    const title = session.title ?? "";
    const id = session.sessionId ?? "";
    const cwd = session.cwd ?? "";
    return title.toLowerCase().includes(needle) || id.toLowerCase().includes(needle) || cwd.toLowerCase().includes(needle);
  });
  const projection = state.move?.projection;
  const noticeText = state.notice?.kind === "ok" ? t("settings.moved") + (projection === void 0 || projection === "bound" || projection === "folded" ? "" : " \xB7 " + (projection === "retagged" ? t("settings.projectionRetagged") : t("settings.projectionStale"))) : state.notice?.kind === "error" ? t("settings.moveFailed") + ": " + state.notice.text : void 0;
  const noticeColor = state.notice?.kind === "error" || state.notice?.kind === "ok" && projection !== void 0 && projection !== "bound" && projection !== "folded" ? "var(--dsw-alias-label-error)" : "var(--dsw-alias-state-success-primary)";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", { style: headerStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: titleStyle, children: t("settings.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: descriptionStyle, children: t("settings.description") })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: bodyStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: toolbarStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            value: filter,
            placeholder: t("settings.filterPlaceholder"),
            onChange: (event) => {
              setFilter(event.target.value);
            },
            style: inputStyle
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: buttonStyle, onClick: () => {
          void props.refresh();
        }, children: t("settings.refresh") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: buttonStyle,
            disabled: busy === REPAIR_KEY,
            onClick: () => {
              setBusy(REPAIR_KEY);
              setLocalError(null);
              void props.repair().finally(() => {
                setBusy(null);
              });
            },
            children: busy === REPAIR_KEY ? t("settings.repairing") : t("settings.repairMetadata")
          }
        )
      ] }),
      sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: cellMutedStyle, children: t("settings.noSessions") }) : sessions.map((session) => {
        const current2 = state.workspaces.find((workspace) => workspace.workspaceId === session.workspaceId);
        const value = session.workspaceId ?? "";
        const disabled = session.live || busy === session.sessionId;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: rowStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: cellTitleStyle, children: session.title ?? session.sessionId }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: cellMutedStyle, children: session.cwd ?? "" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: cellMutedStyle, children: current2 !== void 0 ? current2.title + " \u2014 " + current2.path : t("settings.ungrouped") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "select",
              {
                value,
                disabled,
                style: selectStyle,
                onChange: (event) => {
                  const next = event.target.value === "" ? null : event.target.value;
                  setBusy(session.sessionId);
                  setLocalError(null);
                  void Promise.resolve().then(() => props.move(session.sessionId, next)).then((outcome) => {
                    setBusy(null);
                    if (outcome === "reload") window.location.reload();
                  }).catch((error) => {
                    setBusy(null);
                    setLocalError(error instanceof Error ? error.message : String(error));
                  });
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: t("settings.ungrouped") }),
                  state.workspaces.map((workspace) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", { value: workspace.workspaceId, children: [
                    workspace.title,
                    " \u2014 ",
                    workspace.path
                  ] }, workspace.workspaceId))
                ]
              }
            ),
            session.live ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: cellMutedStyle, children: t("settings.liveSession") }) : null
          ] })
        ] }, session.sessionId);
      }),
      localError !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { ...noticeStyle, color: "var(--dsw-alias-label-error)" }, role: "status", children: t("settings.moveFailed") + ": " + localError }) : null,
      state.repair !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: noticeStyle, role: "status", children: t("settings.repairDone") + " \u2014 " + state.repair.repaired + "/" + state.repair.scanned + (state.repair.failed > 0 ? " \xB7 " + t("settings.repairFailedCount") + " " + state.repair.failed : "") }) : null,
      noticeText !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { ...noticeStyle, color: noticeColor }, role: "status", children: noticeText }) : null
    ] })
  ] });
}

// src/client/locales.ts
var zh = {
  "settings.title": "\u4F1A\u8BDD\u5DE5\u4F5C\u533A\u9644\u5C5E",
  "settings.description": "\u5C06\u5386\u53F2\u4F1A\u8BDD\u91CD\u65B0\u5F52\u5C5E\u5230\u67D0\u4E2A\u5DE5\u4F5C\u533A\uFF0C\u6216\u79FB\u51FA\u6240\u6709\u5DE5\u4F5C\u533A\uFF08\u672A\u5206\u7EC4\uFF09",
  "settings.filterPlaceholder": "\u6309\u6807\u9898\u3001\u4F1A\u8BDD ID \u6216\u8DEF\u5F84\u7B5B\u9009",
  "settings.refresh": "\u5237\u65B0",
  "settings.currentWorkspace": "\u5F53\u524D",
  "settings.targetWorkspace": "\u76EE\u6807\u5DE5\u4F5C\u533A",
  "settings.ungrouped": "\u672A\u5206\u7EC4",
  "settings.liveSession": "\u4F7F\u7528\u4E2D\uFF0C\u4E0D\u53EF\u79FB\u52A8",
  "settings.noSessions": "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u4F1A\u8BDD",
  "settings.unavailable": "\u63D2\u4EF6\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u8BF7\u786E\u8BA4 Host \u63D2\u4EF6\u5DF2\u5B89\u88C5\u5E76\u91CD\u542F DSH",
  "settings.moveFailed": "\u79FB\u52A8\u5931\u8D25",
  "settings.moved": "\u5DF2\u79FB\u52A8",
  "settings.projectionRetagged": "\u6807\u9898\u4E0E\u65F6\u95F4\u5DF2\u968F\u4E4B\u8FC1\u79FB",
  "settings.projectionStale": "\u6807\u9898\u4E0E\u65F6\u95F4\u7F13\u5B58\u672A\u80FD\u91CD\u5EFA\uFF0C\u6253\u5F00\u8BE5\u4F1A\u8BDD\u4E00\u6B21\u5373\u53EF\u6062\u590D",
  "settings.repairMetadata": "\u4FEE\u590D\u6807\u9898/\u65F6\u95F4\u7F13\u5B58",
  "settings.repairing": "\u4FEE\u590D\u4E2D\u2026",
  "settings.repairDone": "\u7F13\u5B58\u5DF2\u4FEE\u590D",
  "settings.repairFailedCount": "\u672A\u80FD\u4FEE\u590D"
};
var en = {
  "settings.title": "Session Workspace Affiliation",
  "settings.description": "Reassign a historical session to a workspace, or remove it from all workspaces.",
  "settings.filterPlaceholder": "Filter by title, session ID or path",
  "settings.refresh": "Refresh",
  "settings.currentWorkspace": "Current",
  "settings.targetWorkspace": "Target workspace",
  "settings.ungrouped": "Ungrouped",
  "settings.liveSession": "In use, cannot move",
  "settings.noSessions": "No sessions to show",
  "settings.unavailable": "Plugin service unavailable. Confirm the host plugin is installed and restart DSH.",
  "settings.moveFailed": "Move failed",
  "settings.moved": "Moved",
  "settings.projectionRetagged": "title and time moved with it",
  "settings.projectionStale": "title/time cache could not be rebuilt; open the session once to restore it",
  "settings.repairMetadata": "Repair title/time cache",
  "settings.repairing": "Repairing\u2026",
  "settings.repairDone": "Cache repaired",
  "settings.repairFailedCount": "failed"
};

// src/client/index.ts
var NS = "dsh-edit-file-workspace";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "edit-file-workspace: dictionaries");
  const t = ctx.locale.bind(NS);
  const controller = new EditFileWorkspaceCardController(ctx);
  ctx.slots.inject("settings.section", () => {
    const unregister = ctx.slots.register({
      name: "settings.section",
      id: "dsh-edit-file-workspace",
      order: 100,
      label: () => t("settings.title"),
      locale: NS,
      inject: () => controller.inject()
    }, EditFileWorkspaceCard);
    return () => {
      controller.dispose();
      unregister();
    };
  });
}

    return module.exports;
  }
});