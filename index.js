/*! Byda.js 1.0.2 || Eric McDaniel */
;(function(window, document) {

    var _base, // Default base path.
        _localCache, // Experimental
        _cache, // Experimental
        _globalComplete, // Stores a callback function called after Byda is complete.
        _imports, // Disable HTML5 imports by default.
        _suffix = 'load'; // Default data-attribute suffix.

    // Check to see if the browser supports HTML5 imports.
    var _supportsImports = 'import' in document.createElement('link');

    // An empty callback function.
    function noop() {}

    /**
     * Core Functions
     */

    // Get any elements with the data attribute generated by _getSelector().
    function _get(dom) {
        dom = 'string' == typeof dom ? new DOMParser().parseFromString(dom, 'text/html') : document;
        if (dom.nodeType) return dom.querySelectorAll(_getSelector());
    }

    // Get the data attribute selector that is used across Byda.
    function _getSelector() {
        return '[data-' + _suffix + ']';
    }

    function _getCached(name) {
        var result = _localCache ? _localCache['byda-' + name] : _cache ? _cache[name] : '';

        return result;
    }

    function _setCached(name, value) {
        if (_localCache) _localCache['byda-' + name] = value;

        if (_cache) _cache.byda[name] = value;
    }

    // Parse options and begin XHR
    function byda(options, callback) {
        if (!options) return;

        // If a string is passed as the options paramter, assume it is a path to a file
        if ('string' == typeof options) options = { file: options };

        // options.view is shorthand for 'views/{name}.html'.
        if (options.view) options.file =  'views/' + options.view + '.html';

        // If a callback is passed as the second parameter, add or overwrite options.callback.
        options.callback = callback;

        // If options.json exists, create an object with the request (string or array), and an empty
        // results object.

        options.json = {
            req: 'string' == typeof options.json ? [{ name: 'default', file: options.json }] : options.json || [],
            res: {}
        };

        // If Byda was initialized with imports: true and the browser supports imports, use HTML5
        // imports.
        if (_imports && _supportsImports) {

            // Create a new <link> element.
            var link = document.createElement('link');

            // Define an href variable that contains the link to the file/view being loaded.
            var href = options.file;

            if (_base) href = _base + '/' + href;

            // Set the rel attribute of the link element to 'import' and the href to the href
            // variable.
            link.rel = 'import';
            link.href = href;

            // Detect a current link element with an identical href value.
            var current = document.querySelector('link[href="' + href + '"]');

            // If it exists, remove it from the DOM.
            if (current) current.remove();

            // When the link attribute is done loading, reference the import contents with
            // the options.import property and start a new request to catch any json requests
            // that were passed in the options.
            link.onload = function(e) {
                options.import = link.import;
                _request(options);
            };

            // Error handler
            link.onerror = function(e) {
                _failure(options);
            };

            // Append the newly created link element to the head of the document.
            document.head.appendChild(link);
        } else {
            // Start XHR with options.
            _request(options);
        }
    }

    // Retrieve the contents of json files specified in options.json and the view specified in
    // options.file.
    function _request(options) {
        var json = options.json.req[0], // Stores the JSON request (if any).
            response; // Stores the raw responseText or JSON parsed responseText.

        var file = json ? json.file : options.file;

        if (!file) return options.import ? _success(options.import, options) : _complete(options);

        // Abort if xhr exists and the readyState is less than 4 (complete).
        if (xhr && xhr.readyState < 4) {
            xhr.onreadystatechange = noop;
            xhr.abort();
        }

        // Create a new XMLHtttpRequest.
        var xhr = new XMLHttpRequest();

        // If a base path is specified, prepend it to the file path.
        file = _base ? _base + '/' + file : file;

        // Open the XHR.
        xhr.open('GET', file, true);
        xhr.setRequestHeader('X-BYDA', 'true');

        // Detect readystatechange.
        xhr.onreadystatechange = function() {
            // If the readyState is 4 (complete):
            if (xhr.readyState == 4) {
                if (json) options.json.req.splice(0,1);
                // and the XHR status returns 200 (got the file) or the file string contains
                // "file:///" (important for mobile/PhoneGap applications)
                if (xhr.status == 200 || (xhr.status === 0 && file.indexOf('file:///') != -1)) {
                    // If there is a json, parse the responseText as JSON.
                    var text = xhr.responseText;

                    if (!json) return _success(text, options);

                    response = JSON.parse(text);

                    // If it is a single, default request, set the result to the response for
                    // easy access upon completion. If there are multiple requests, add it to
                    // the results object.
                    if (json.name == 'default')
                        options.json.res = response;
                    else
                        options.json.res[json.name] = response;

                    // Begin a new request with the remaining options.
                    _request(options);
                // The file was not found.
                } else {
                    // If the request was a JSON request:
                    if (json) _request(options);
                    // Couldn't find the view file, so no content could be loaded.
                    _failure(options);
                }
            }
        };

        // Send the XHR
        xhr.send();
    }

    // XHR succeeded and we can begin swapping content
    function _success(response, options) {
        byda.flash()
            .generate(byda.flash({ dom: response }))
            .run();
        // Complete Byda with the options.
        _complete(options);
    }

    function _failure(options) {
        throw new Error('Could not get: ' + options.file);
    }

    // Perform callback functions
    function _complete(options) {
        var flash = byda.flash();

        // If a local complete callback was specified, call it with a flash of the updated elements
        // and any JSON results
        // If a global complete callback was specified, call it with the options
        return _globalComplete && _globalComplete(flash, options) ||
        options.callback && options.callback(flash, options.json ? options.json.res : null);
    }

    /**
     * Object Constructors
     */

    // A Change contains an index element and a corresponding element from a loaded file
    function Change(store, from, to) {
        this.store = store;
        this.from = from;
        this.to = to;
    }

    // Swap the innerHTML value of the index element to the innerHTML value of the loaded element
    // or the value of a simulated element if this.to is not a node.
    Change.prototype.swap = function() {
        if (!this.from || !this.to) return;

        var value = this.to.nodeType ? this.to.value || this.to.innerHTML : this.to;

        if (!value) value = _getCached(this.store) || '';

        if (this.from.hasAttribute('value'))
            this.from.value = value;
        else
            this.from.innerHTML = value;

        return this;
    };

    // A Collection contains a list of Byda elements that can be manipulated with Flash#add, and a
    // value that can be get and set with Flash#get and Flash#set.
    function Store(name, value) {
        this.name = name;
        this.list = [];
        this.changes = [];
        this.value = value || _getCached(name);
    }

    Store.prototype.emit = function() {
        var e;

        var options = {
            detail: {
                name: this.name,
                value: this.value
            },
            bubbles: true,
            cancelable: true
        };

        if ('function' == typeof CustomEvent) {
            e = new CustomEvent('byda', options);
        } else if (document.createEvent) {
            e = document.createEvent('CustomEvent');
            e.initCustomEvent('byda', options.bubbles, options.cancelable, options.detail);
        }

        window.dispatchEvent(e);
    };

    Store.prototype.set = function(value, options) {
        var _i, _len, cache, el;

        if (options) cache = options.cache;

        if ('function' == typeof value)
            value = value(this.value);
        else if ('object' == typeof value)
            value = value[this.name];

        if (!value) value = _getCached(this.name) || '';

        for (_i = 0, _len = this.list.length; _i < _len; _i++) {
            el = this.list[_i];

            if (el.hasAttribute('value'))
                el.value = value;
            else
                el.innerHTML = value;
        }

        this.value = value;

        if (cache) _setCached(this.name, this.value);

        this.emit();
    };

    Store.prototype.get = function() {
        return this.value;
    };

    Store.prototype.compare = function(store) {
        var _i, _len, change;
        for (_i = 0, _len = this.list.length; _i < _len; _i++) {
            this.changes.push(new Change(this.name, this.list[_i], store.list[_i]));
        }
    };

    Store.prototype.commit = function() {
        var _i, _len;
        for (_i = 0, _len = this.changes.length; _i < _len; _i++) this.changes[_i].swap();
    };

    // A Flash contains a list of Byda elements that can be organized, compared against other
    // flashes.
    function Flash(options) {
        // If no options were passed, create a new empty options object.
        if (!options) options = {};

        this.dom = options.dom;

        // Collect a flat list of the Byda elements by calling byda.get() with either an imported
        // DOM if one was passed or no DOM. In the case of no DOM, the byda.get() will use the
        // document.
        this.list = this.dom ? _get(this.dom) : _get();

        // Set the flash to frozen or not. If frozen is passed, the Byda elements will be cloned
        // when initialized; therefore, the collections will contained cloned elements and not
        // references to elements on the page.
        this.frozen = options.frozen;

        // Organize the list into stores.
        this.organize();
    }

    Flash.prototype.update = function() {
        return this.organize(this.dom ? _get(this.dom) : _get());
    };

    // Add an element to the flash's list or a specified collection in the flash.
    Flash.prototype.add = function(name, node) {
        if ('string' == typeof name && node.nodeType) this.find(name).list.push(node);
        return this;
    };

    // Find and return a store.
    Flash.prototype.find = function(name) {
        return this.stores[name];
    };

    // Map a simulated list of changes to the Flash with an object.
    Flash.prototype.map = function(object, options) {
        var store;
        for (var sim in object) {
            store = this.stores[sim];
            if (store) store.set(object[sim]);
        }
        return this;
    };

    // Compare the flash's stores to another and load lists of changes objects
    // into the source collections.
    Flash.prototype.generate = function(flash) {
        var store;
        for (var name in this.stores) {
            store = flash.stores[name];
            if (store) this.stores[name].compare(store);
        }
        return this;
    };

    // Organize a list of elements into groups by their Byda data-attribute value.
    Flash.prototype.organize = function(list) {
        var _i, _len, el, name;

        // Reset the elements object.
        this.stores = {};

        // If list of elements parameter wasn't provided, use the intrinsic list.
        if (list) this.list = list;

        for (_i = 0, _len = this.list.length; _i < _len; _i++) {
            name = this.list[_i].getAttribute('data-' + _suffix);
            el = this.list[_i];
            if (this.frozen) el = el.cloneNode(true);
            // Create a new store if one does not exist with the name.
            if (!this.stores[name]) this.stores[name] = new Store(name, el.value || el.innerHTML);
            this.add(name, el);
        }

        return this;
    };

    // Call the swap method on each change in the flashes list of changes.
    Flash.prototype.run = function() {
        for (var store in this.stores) this.stores[store].commit();
    };

    /**
     * Exposed Functions
     */

    // Initialize Byda with options.
    byda.init = function(options) {
        // Return if no options parameter was passed.
        if (!options) return;

        // The options 'data' and 'suffix' are valid to specify a data attribute suffix.
        _suffix = 'string' == typeof options ? options : options.suffix = options.data || _suffix;

        // Cache Options (Experimental)
        _localCache = options.local;
        _cache = options.cache;
        if (_cache && !_cache.byda) _cache.byda = {};

        // Use HTML imports instead of XHR
        _imports = options.imports;

        // Set the base variable to a file path string.
        _base = options.base;

        // Set the global complete callback to the options.complete function.
        _globalComplete = options.complete;
    };

    // Set the base path to a specified string.
    byda.base = function(string) {
        _base = string || _base;
        return _base;
    };

    // Return a new Flash object.
    byda.flash = function(options) {
        return new Flash(options);
    };

    /**
     * Expose Byda
     */

    window.byda = byda;

})(window, document);
