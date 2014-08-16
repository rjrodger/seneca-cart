seneca-cart - a [Seneca](http://senecajs.org) plugin
======================================================

Seneca shopping cart plugin

[![Build Status](https://travis-ci.org/rjrodger/seneca-cart.png?branch=master)](https://travis-ci.org/rjrodger/seneca-cart)

[![NPM](https://nodei.co/npm/seneca-cart.png)](https://nodei.co/npm/seneca-cart/)
[![NPM](https://nodei.co/npm-dl/seneca-cart.png)](https://nodei.co/npm-dl/seneca-cart/)

Prerequisites
-------------

seneca-cart is a [Seneca](http://senecajs.org/) plugin.  In order to use seneca-cart, you must have Seneca installed in your project.  Make sure `seneca` is a dependency in your `package.json` file, and run `npm install`

Setup
-----

TODO

Commands
--------

### create(options, callback)
Creates a new cart entity for persisting data about the status and items of the unique shopping cart.
* options `Object` - optional custom keys and values to be set on the cart object.  These custom properties will persist on the cart object.
* callback `Function` - takes two arguments, `err` and `out`.  `out` is an object with property `cart`.  `cart` has the following properties:
	- id `String` - a unique identifier for the persistent cart.
	- created `Date` - a JavaScript `Date` object that shows the time and date of the cart's creation
	- modified `Date` - a JavaScript `Date` object that shows the time and date of the cart's last modification
	- entries `Array` - a list of all product entities currently in the cart.  Should initially be empty.
	- total `Number` - the dollar total of all items in the cart.
	- status `String` - either 'open' or 'closed', indicating the current status of the cart.


Example
-------

TODO
