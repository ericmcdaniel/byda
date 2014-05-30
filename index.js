/*! Byda.js 2.0.2 || Eric McDaniel */
;( function( window, document ) {

    'use strict';

    /**
     * Variables
     */

    var noop = function() {}; // An empty callback function.

    var base, // Default base path
        animations = {}, // A hash that specifies animation callbacks for stores.
        imports, // Utilize HTML5 imports instead of XHR.
        supportsImports = 'import' in document.createElement( 'link' ),
        suffix = 'load', // Default data-attribute suffix.
        globalComplete = noop; // A callback function to be run when Byda is complete.

    /**
     * Helpers
     */

    /**
     * Get a list of all elements containing the attribute generated by getBydaSelector()
     * @param  {String} dom HTML string to use as DOM
     * @return {Object}     A list of elements generated by querySelectorAll
     */
    function getBydaElements( dom ) {
        var blocked = [],
            clean = [],
            list;

        dom = 'string' == typeof dom ? new DOMParser().parseFromString( dom, 'text/html' ) : dom;

        if ( isNode( dom ) ) {
            list = dom.querySelectorAll( getBydaSelector() );

            for (var i = list.length - 1; i >= 0; i--) {
                if ( /\^$/.test( list[ i ].getAttribute( 'data-' + suffix ) ) ) blocked.push( list[ i ] );
                else clean.push( list[ i ] );
            }

            // Filter every element that does not pass the criteria
            return clean.filter( function( element ) {
                // Returns true if every blocked element does not have the tested element as it's child
                return blocked.every( function( block ) {
                    return !block.contains( element );
                });
            });
        }
    }

    /**
     * Get the data attribute selector that is used across Byda.
     * @return {String} A data-attribute selector string
     */
    function getBydaSelector() {
        return '[data-' + suffix + ']';
    }

    /**
     * Check if an object is a node.
     * @param  {Object}  obj An element or JavaScript object.
     * @return {Boolean}     Is or is not a DOM node or HTML element.
     */
    function isNode( obj ) {
        return 'object' == typeof obj && !! obj.nodeType;
    }

    /**
     * Core Functions
     */

    /**
     * Parse options and begin XHR or HTML import.
     * @param  {Object}   options  Options
     * @param  {Function} callback A callback function that occurs when the content is loaded.
     */
    function byda( options, callback ) {
        // Halt if the function wasn't passed options.
        if ( !options ) return;

        if ( 'function' == typeof options ) return options.apply( byda.flash() );

        // Assume a string passed as the first parameter is a path to a file.
        if ( 'string' == typeof options ) options = { file: options };

        // options.view is shorthand for 'views/{name}.html'.
        if ( options.view ) options.file = 'views/' + options.view + '.html';

        // Assign the callback (if any) to the options.callback property.
        options.callback = callback || noop;

        // Restructure the options.json object based on its type.
        options.json = {
            req: 'string' == typeof options.json ? [ {
                name: 'default',
                file: options.json
            } ] : options.json || [],
            res: {}
        };

        // Use HTML imports if supported and Byda was initialized with `import: true`.
        if ( imports && supportsImports ) {
            // Define an href variable that contains the link to the file/view being loaded.
            var href = base ? base + '/' + options.file : options.file;

            // Detect a current link element with an identical href value.
            var current = document.querySelector( 'link[href="' + href + '"]' );

            // If an identical link element was found, use it.
            if ( current ) {
                options.imp = current[ 'import' ];
                return request( options ); // Start XHR with options.
            }

            var link = document.createElement( 'link' ); // Create a new link element.

            link.rel = 'import'; // Specify the link elements relationship as an import.
            link.href = href; // Apply the href to the element.

            // When the link attribute is done loading, reference the import contents with
            // the options.imp property and start a new request to catch any json requests
            // that were passed in the options.
            link.onload = function( e ) {
                options.imp = link[ 'import' ];
                request( options );
            };

            link.onerror = function( e ) {
                failure( options ); // Handle the error.
            };

            // Append the newly created link element to the head of the document.
            document.head.appendChild( link );
        } else {
            request( options );
        }
    }

    /**
     * Retrieve the contents of JSON files and the view or template.
     * @param  {Object} options Options
     */
    function request( options ) {
        var response; // Stores the raw responseText or JSON parsed responseText.
        var json = options.json.req[ 0 ]; // Stores the JSON request (if any).

        // Set the file in question to options.file or the file in a JSON request (if any).
        var file = json ? json.file : options.file;

        // Complete and run success() if an HTML import took place. Complete prematurely if no
        // file found.
        if ( !file ) return success( '', options );
        // if ( options.imp ) return success( options.imp, options );

        // Abort if xhr exists and the readyState is less than 4 (complete).
        if ( xhr && xhr.readyState < 4 ) {
            xhr.onreadystatechange = noop;
            xhr.abort();
        }

        // Create a new XMLHtttpRequest.
        var xhr = new XMLHttpRequest();

        // If a base path is specified, prepend it to the file path.
        file = base ? base + '/' + file : file;

        xhr.open( 'GET', file, true );
        xhr.setRequestHeader( 'X-BYDA', 'true' );

        xhr.onreadystatechange = function() {
            if ( xhr.readyState == 4 ) {
                if ( json ) options.json.req.splice( 0, 1 );
                // If the XHR status returns 200 (got the file) or the file string contains
                // "file:///" (important for mobile/PhoneGap applications)
                if ( xhr.status == 200 || ( xhr.status === 0 && file.indexOf( 'file:///' ) != -1 ) ) {
                    // If there is a json, parse the responseText as JSON.
                    var text = xhr.responseText;

                    // Complete and run success if it was not a request for a JSON file.
                    if ( !json ) return success( text, options );

                    // Parse the response as JSON.
                    response = JSON.parse( text );

                    // If it is a single, default request, set the result to the response for
                    // easy access upon completion. If there are multiple requests, add it to
                    // the results object.
                    if ( json.name == 'default' ) options.json.res = response;
                    else options.json.res[ json.name ] = response;

                    // Begin a new request with the remaining options.
                    request( options );
                } else {
                    // If the request was a JSON request:
                    if ( json ) request( options );

                    // Couldn't find the view file, so no content could be loaded.
                    failure( options );
                }
            }
        };
        // Send the XHR
        xhr.send();
    }

    /**
     * Create a flash, generate changes, perform those changes and handle callbacks.
     * @param  {String} response A response string to use as a DOM
     * @param  {Object} options  Options
     */
    function success( response, options ) {
        byda.flash( { dom: options.dom, animations: options.animations } ) // Create a new flash.
            .generate( byda.flash( { // Create a flash based on the response and generate changes.
                dom: response
            } ) )
            .run( function() { // Perform the changes with start and finish callbacks.
                options.callback.apply( this.update(), [ options.json.res ] );
            }, function() {
                globalComplete( options ); // Perform the global callback.
            } );
    }

    /**
     * XHR or HTML import failure handler.
     * @param  {Object} options Options
     */
    function failure( options ) {
        throw new Error( 'Could not get: ' + options.file );
    }

    /**
     * Object Constructors
     */

    /**
     * [Store description]
     * @param {String} name      Name of the store
     * @param {String} value     Value of the store
     * @param {Function} animation Animation function to perform
     */
    function Store( name, value, animation ) {
        this.name = name;
        this.list = [];
        this.animation = animation;
        this.value = value;
    }

    /**
     * Trigger a 'byda' event on the window with details of the store and change.
     */
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

        if ( 'function' == typeof CustomEvent ) {
            e = new CustomEvent( 'byda', options );
        } else if ( document.createEvent ) {
            e = document.createEvent( 'CustomEvent' );
            e.initCustomEvent( 'byda', options.bubbles, options.cancelable, options.detail );
        }

        window.dispatchEvent( e );
    };

    /**
     * Set the value of a store and its elements.
     * @param {String} value   Value of the store
     * @param {Object} options Options
     */
    Store.prototype.set = function( value, options ) {
        var _i, node;

        if ( 'object' == typeof value ) value = value[ this.name ];

        if ( !value ) value = '';

        for ( _i = this.list.length - 1; _i >= 0; _i-- ) {
            node = this.list[ _i ];

            if ( 'value' in node ) node.value = value;
            else node.innerHTML = value;
        }

        this.value = value;

        this.emit();

        return this;
    };

    /**
     * Return the value of the store.
     * @return {String} Value of the store
     */
    Store.prototype.get = function() {
        return this.value;
    };

    /**
     * Set the 'to' property of the store to the first element in the store of interest.
     * @param  {Object} store Store of interest
     */
    Store.prototype.compare = function( store ) {
        if ( 'object' == typeof store ) {
            this.to = store.list[ 0 ];
        }
        return this;
    };

    /**
     * Change the elements and value of the store to the 'to' property set by compare()
     * If an animation was specified, call the function with the done() function
     * to indicate when the animation has completed, a reference to the 'animating-out' element
     * and a cloned 'animating-in' element.
     * @param  {Function} done Callback
     */
    Store.prototype.commit = function( done ) {
        var that = this;

        // Set value (if applicable) and run the done callback.
        function complete() {
            if ( value ) that.set( value );
            if ( el ) {
                if ( el.parentNode ) el.parentNode.removeChild( el );
            }
            return done && done( that.name );
        }

        if ( !this.to ) return complete(); // Complete the commit if no change is present.

        // If this.to is an element, set the value to the value attribute or innerHTML content. If
        // not, set the value to this.to.
        var value = isNode( this.to ) ? this.to.value || this.to.innerHTML : this.to;
        var list = this.list; // Reference the list.
        var el, clone;

        if ( !value ) value = '';

        // If byda was initialized with an animation function corresponding to the name of the
        // store, perform the animation with the 'animating-out' and 'animating-in' elements,
        // and a callback function.
        if ( 'function' == typeof this.animation ) {
            for ( var _i = list.length - 1; _i >= 0; _i-- ) {
                el = list[ _i ];

                clone = el.cloneNode( true ); // Clone the 'animating-out' node.

                el.setAttribute( 'data-' + suffix, '^' ); // Block the byda element to prevent duplicates

                clone.innerHTML = value; // Set up the innerHTML content of the 'animating-in' node.

                this.animation( el, clone, complete ); // Perform the animation
            }
        } else {
            complete();
        }
    };

    /**
     * Contains organizations of byda elements (Stores) and methods to perform on those stores.
     * @param {Object} options Options
     */
    function Flash( options ) {
        // If no options were passed, create a new empty options object.
        if ( !options ) options = {};

        this.dom = options.dom || document;

        // Collect a flat list of Byda elements with the specified DOM ( or window.document )
        this.list = getBydaElements( this.dom );

        this.animations = options.animations || {};

        // Set the flash to frozen or not. If frozen is passed, the Byda elements will be cloned
        // when initialized; therefore, the collections will contained cloned elements and not
        // references to elements on the page.
        if ( options.frozen ) this.frozen = true;

        this.organize(); // Organize the list into stores.
    }

    /**
     * Updates the flash with new stores
     */
    Flash.prototype.update = function() {
        return this.organize( getBydaElements( this.dom ) );
    };

    /**
     * Return the number of stores in the flash.
     * @return {Number} Number of stores in the flash
     */
    Flash.prototype.count = function() {
        var _i = 0;

        for ( var store in this.stores ) _i++;

        return _i;
    };

    /**
     * Find and return a store in the flash by name.
     * @param  {String} name Name of the store
     * @return {Object}      Store
     */
    Flash.prototype.find = function( name ) {
        return this.stores[ name ];
    };

    /**
     * Map a simulated list of changes to the flash with an object.
     * @param  {Object} object  Object who's key/values correspond to the stores
     * @param  {Object} options Options
     */
    Flash.prototype.map = function( object, options ) {
        for ( var key in object ) {
            if ( this.stores[ key ] ) this.stores[ key ].set( object[ key ] );
        }

        return this;
    };

    Flash.prototype.condense = function() {
        var res = {};
        var stores = this.stores;

        for ( var store in stores ) res[ store ] = stores[ store ].get();

        return res;
    };

    /**
     * Compare stores in the flash to the stores in a flash of interest, and
     * load changes into the stores of the source flash.
     * @param  {Object} flash Flash
     */
    Flash.prototype.generate = function( flash ) {
        for ( var name in this.stores ) {
            this.stores[ name ].compare( flash.stores[ name ] );
        }

        return this;
    };

    // Organize a list of elements into groups by their Byda data-attribute value.
    /**
     * Organize a list of elements into groups by their byda data-attribute value.
     * @param  {[type]} list [description]
     * @return {[type]}      [description]
     */
    Flash.prototype.organize = function( list ) {
        var _i, node, name;

        // Reset the stores object.
        var stores = this.stores = {};

        // If a list was provided, update the list belonging to the flash.
        if ( list ) this.list = list;

        // Loop through the list and create new stores.
        for ( _i = this.list.length - 1; _i >= 0; _i-- ) {
            node = this.list[ _i ];
            name = node.getAttribute( 'data-' + suffix );

            // Make a clone of the node if the flash is meant to be frozen.
            if ( this.frozen ) node = node.cloneNode( true );

            // Create a new store if one does not exist with the name.
            if ( !stores[ name ] ) {
                stores[ name ] = new Store( name, node.value || node.innerHTML, this.animations[ name ] || animations[ name ] );
            }

            // Push the reference or newly cloned element to the store.
            stores[ name ].list.push( node );
        }

        return this;
    };

    /**
     * Call the commit method of each store in the flash
     * @param  {[type]} start  [description]
     * @param  {[type]} finish [description]
     * @return {[type]}        [description]
     */
    Flash.prototype.run = function( start, finish ) {
        var count = this.count();
        var finished = []; // An array of completed stores.

        // A callback run when a commit is completed.
        function done( detail ) {
            finished.push( detail ); // Push the details to the finished array.

            // If the number of stores in the flash equals the number of stores in the finished
            // array, run the finish callback.
            if ( count == finished.length ) return finish && finish();
        }

        // Begin each of the commit functions.
        for ( var store in this.stores ) this.stores[ store ].commit( done );

        if ( 'function' == typeof start ) start.apply( this ); // Run the specified start function.
    };

    /**
     * Exposed Functions
     */

    /**
     * Initialize byda with options
     * @param  {Object} options Options
     */
    byda.init = function( options ) {
        if ( !options ) return; // Return if nothing was passed.

        // The options 'data' and 'suffix' are valid to specify a data attribute suffix.
        suffix = 'string' == typeof options ? options : options.data || suffix;

        animations = options.animations || animations; // Animations object.

        imports = options.imports; // Use HTML imports instead of XHR.

        base = options.base; // Set the base variable to a file path string.

        globalComplete = options.complete || noop; // A global complete callback.
    };

    /**
     * Get/set the base path
     * @param  {String} path Base path
     * @return {String}      Base path
     */
    byda.base = function( path ) {
        if ('string' == typeof path) base = path;
        return base;
    };

    /**
     * Create a new flash with options
     * @param  {Object} options Options
     * @return {Object}         Flash
     */
    byda.flash = function( options ) {
        return new Flash( options );
    };

    /**
     * Expose Byda
     */

    window.byda = byda;

} )( window, document );