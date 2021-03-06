#byda.js [![Build Status](https://travis-ci.org/ericmcdaniel/byda.svg?branch=master)](https://travis-ci.org/ericmcdaniel/byda)

Note: This library is no longer maintained.

Byda is a JavaScript library that facilitates content swapping ( without
page reload ) via
[HTML5 imports](http://www.html5rocks.com/en/tutorials/webcomponents/imports/) or [XHR](http://en.wikipedia.org/wiki/XMLHttpRequest) ( Ajax ). Byda does not provide any
[pushState](https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Manipulating_the_browser_history) functionality, nor is it a full-featured templating engine. The
library provides a public API that allows it to be implemented in a variety
of ways outside the core implementation.

Byda is currently ~3.9kb minified and ~1.7k minified + gzipped.

### Concept

Byda will create an object ( _Flash_ ) that contains organizations of elements on
the page arranged by data-attribute ( _Store_ ) that can then be compared against
other flashes to generate changes to perform. Byda's core functions will be
exposed as a basic content-swapping/templating library, but the APIs of _Flash_
and _Store_ are also exposed to provide more flexibility to authors.

**Byda should**

* work via HTML5 imports or XHR,

* work cross browser and cross platform,

* be optimized for mobile platforms,

* cache flashes in memory to improve performance,

* and stay < 5k in size.


### Use Cases

* Single-page sites

* Mobile websites / PhoneGap applications

* Simple, interactive widgets ( ex: sliders ) who's content is loaded on-demand

* A basic level of persistence to enhance UX in simple sites or mobile apps

######Notes

* A flash is just a wrapper for the stores at the moment the flash is generated.

* A flash exposes methods that let you do bulk actions on the stores it
contains.

* Stores have a value and a list. This value is set across elements within the
store. Calling `store.set( value )` will set the innerHTML ( or value for inputs )
of all of the elements in the list to the specified string.

###Basic Example

Here is a very simple example of content loading with Byda.

####index.html
```html
...
	<!-- CSS, JS -->
	<script src="byda.js"></script>
</head>
<body>
	<div class="Header">
		<h3 class="Header-title" data-load="title">
			<!-- 'Home' loaded here -->
		</h3>
		<div class="Header-nav" data-load="navigation">
			<ul class="Navigation">
				<li>
					<a href="/home" class="selected">Home</a>
				</li>
                <li>
                    <a href="/page/1">Page 1</a>
				</li>
                <li>
                    <a href="/page/2">Page 2</a>
				</li>
			</ul>
		</div>
	</div>
	<div class="Main">
		<div class="Main-content" data-load="content">
			<!-- 'Paragraph content.' loaded here -->
		</div>
	</div>
	<script>
		byda( { file: 'views/home.html' } );
	</script>
</body>
...
```

####views/home.html
```html
<h3 data-load="title">Home</h3>

<div data-load="content">
	<p>Paragraph content.</p>
</div>
```

At its core, Byda is a simple content swapping function. The function byda()
will retrieve the text contents of a file, parse it as HTML, and swap out
the contents of any HTML elements with corresponding data-suffix values. By
default, suffix is set to 'load'. These examples assume this value is
unchanged.

###Manual Swapping

Sometimes you may not want to use Ajax, but parse a string as DOM and load it
in to your template. Byda has a public API that you can use according to your
needs.

```html
<div data-load="example">I don't have long to live :(</div>
```

```javascript
// Create a simulated flash with some HTML
var simulated = byda.flash( {
	dom: "<div data-load='example'>I died!</div>"
} );

// Create a new flash and overwrite the innerHTML of the template div with the
// innerHTML of simulated div.
byda.flash().generate( simulated ).run();
```

######Notes

* These functions ( flash, generate, run ) are listed and described in the API
documentation below.

* If Byda is passed a function as the first parameter, the function will be
executed with `this` bound to a new flash. For example:

```javascript
var one, two;

byda( function( view ) {
    one = view;
});

two = byda.flash();

// 'one' contains a flash identical to 'two'
```

##Core

The Byda public API is accessed through the `byda` method. This method can be
initialized with the options `file`, `transitions`, and `dom`,
where:

* `file` is the path of a file to be parsed as HTML,

* `transitions` is an object formatted in key-value pairs where the key is the
name of a store and the value is a function passed back reference to an element
animating out ( from ), a newly cloned element animating in ( to ) and a
complete function ( done ),

* and `dom` is a 'container' or 'parent' element to contain the Flash to.

You can pass a callback to the `byda()` function as the second parameter. The
function will be executed with the first parameter bound to a new Flash.

###view

The first parameter of the callback will be a _Flash_ object that contains
important info about the newly loaded content. This object includes a 'stores'
object that contains elements organized by their data-attribute value. Each
organization is called a Store.

####path/to/file.html

```html
    <h2 data-load="title">Byda Example</h2>
    ...
```

```javascript
byda( 'path/to/file.html' , function( view ) {
	// Access the title store (which contains one element)
	view.find( 'title' ).get(); // returns 'Byda Example'
} );
```

##pushState

Combining byda with pushState is pretty cool. [Page.js](http://visionmedia.github.io/page.js/) is a micro-router that
lets us utilize pushState routing for our app:

```javascript
page( '/', function( ctx ) {
	byda( home.options );
});

page( '/calendar/:day', function( ctx ) {
    // Route callbacks are passed back a ctx parameter that contains info about the route.
	var day = ctx.params.day;
	byda( calendar.options, function( data ) {
		console.log( data.activities[ day ] );
	});
});

page();
```

You can now navigate through your Ajax loads with the browser history.

##Transitions

Byda handles transitions via the option `transitions`. The option should be
passed an object with key-value pairs where the key is the name of the store
to be animated and the value is a function. The function is passed a reference
to the element animating out, a newly-cloned element to animate in and a
callback function to run when the animation is complete.

You can design transitions to be reused throughout your application.

Here is an example animation function using jQuery and animate.css:

```javascript
var slideAnimation = function( from, to, done ) {
    $( from ).css( 'position', 'absolute' );
    $( from ).one( 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
        done();
    });
    $( from ).after( to );
    $( from ).addClass('animated slideOutLeft' );
    $( to ).addClass( 'animated slideInRight' );
}

...

byda({
    file: 'views/main.html',
    transitions: {
        content: slideAnimation
    }
}, callback );
```

Be sure to call `done()` when you are done with your animation / DOM
manipulation, as it lets the core know when to end.

######Notes

* The animation function occurs before the global 'complete' callback and
after the 'local' callback passed in as the second parameter of `byda()`.

##Blockers

Byda can recognize particular elements as 'blockers'. These are parent elements
who's contents will be organized into a Flash only if that Flash was made
at the level of that element. This is useful if you want to reuse store names
and encapsulate byda functionality in the DOM.

A blocker is any data-load value with a trailing `^`.

```html
<!-- Outer element -->
<div data-load="content"></div>

<div id="Module" data-load="^">
    <!-- Inner element -->
    <div data-load="content"></div>
</div>
```

```js
byda( function( view ) {
    view.find( 'content' ); // Outer element
});

byda( { dom: document.getElementById( 'Module' ) }, function( view ) {
    view.find( 'content' ); // Inner element
});
```

##Public API

###byda( options, callback )
Load data into your document by data attributes through XHR or HTML5 imports
( if the browser supports it and byda was initialized with 'imports' = true ).

| Option   | typeof   | Description                                                                      |
|----------|----------|----------------------------------------------------------------------------------|
| dom      | string / object   | A string to be parsed as HTML or node at which the byda function begins ( or is scoped ) |
| file     | string   | Path to a file to use as the basis for swapping the content of byda elements.    |fj
| view     | string   | Shorthand for `{ file: 'views/' + path + '.html' }`                              |

###byda.base
Set the base path for XHR and HTML5 imports.

```javascript
byda.base( '/path/to/base' );
```

###byda.init
You can of course initialize byda with options:

```javascript
byda.init( {
	base: '/examples',
	data: 'foo', // will now look for elements with the attribute 'data-foo'
} );
```

| Option     | typeof   | Description                                                                                                                              |
|------------|----------|------------------------------------------------------------------------------------------------------------------------------------------|
| base       | string   | Prepend a base path to all of the requests and imports you perform with byda.                                                            |
| transitions | object   | Map animation functions (that recieve a cloned element to animate) to stores to perform before the global callback and after the local callback. |
| complete   | function | A global complete function that will call after byda is finished.                                                                        |
| data       | string   | Specify a custom data attribute prefix to use. The default is 'load'.                                                                    |
| imports    | boolean  | Use HTML5 imports instead of XHR.                                                                                                         |

######Notes
* Byda will fallback to XHR if the clients browser does not support HTML5
imports.

###byda.flash( options )
Returns a `Flash` object:

| Option | typeof  | Description                                                          |
|--------|---------|----------------------------------------------------------------------|
| dom    | object / string  | A string parsed as HTML or parent node to generate the flash from. |
| frozen | boolean | Clone elements before before pushing them to the list.               |

__Example ( scoped flash ):__

```javascript
var scopedFlash = byda.flash( { dom: document.getElementById( 'Content' ) } );
```

`scopedFlash`'s list and stores are generated from byda elements within the element with
the id 'content'. This means any methods called on the flash will only affect the
byda elements within 'content'.

###byda.get
Returns an array of all byda elements on the page.

####Flash API

| Property | typeof   | Parameters          | Description                                                                                           |
|----------|----------|---------------------|-------------------------------------------------------------------------------------------------------|
| add      | function | store, element      | Add an element to a store.                                                                            |
| count    | function |                     | Return the number of stores in `flash.stores`.                                                        |
| find     | function | name                | Return a store by name.                                                                               |
| generate | function | flash               | Compare to another flash and push the changes to the stores.                                          |
| list     | array    |                     | An unorganized list of all byda elements on the page.                                                 |
| map      | object   |                     | Compare a simple data structure against the Flash and commit the changes.                             |
| organize | function |                     | Organize all elements from this.list or an array specified as the first parameter.                    |
| run      | function | start, finish       | Commit the changes of each store after they have been generated with before and after callbacks.                                    |
| stores   | object   |                     | Contains organizations of byda elements (stores) that exist on the page when the flash was generated. |
| update   | function |                     | Refresh the flash with a new list and organize the list into stores.                                  |

####Store API

| Store | typeof   | Parameters     | Description                         |
|-------|----------|----------------|-------------------------------------|
| get   | function |                | Return the value of the store. |
| set   | function | value, options | Set the value of the store.    |

##License

(The MIT License)

Copyright (c) 2014 Eric McDaniel <eric.g.mcdaniel@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
