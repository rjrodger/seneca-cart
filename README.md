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

Add seneca-cart to your project by adding it as a dependency in your `package.json` file:
```JSON
"dependencies": {
  ...
  "seneca-cart": "X.Y.Z",
  ...
}
```
where X, Y, and Z are the appropriate version numbers. Run `npm install` to install all of the dependencies, including seneca-cart.

### Registering the Plugin

Since seneca-cart is a seneca plugin, it can be registered to the seneca instance simply by adding the line

```JavaScript
seneca.use('cart');
```

Optionally, a second parameter can be used in the `use` method to limit a certain category of product to only have one entry.  If you wanted to only have one item with the category `'fruit'`, you could register the cart with

```JavaScript
seneca.use('cart', {onlyone:'fruit'})
```

### Accessing the Cart

The cart commands are now available via the `seneca.act()` API.  For example, to call the `create` command, with the a custom property, you could write

```JavaScript
seneca.act('role:cart, cmd:create', {custom1:'value1'}, callback);
```

Alternatively, you can pin the engage role to a variable via the `seneca.pin()` API and call the commands as methods.

```JavaScript
var cartpin = seneca.pin({role:'cart',cmd:'*'});
cartpin.create({custom1:'value1'}, callback);
```

A third way to access the seneca-cart commands is through the RESTful API.  The calls to `add_entry`, `remove_entry`, `get`, and `complete` can be accessed by making a request to `/api/cart/{cmd}`.

### Creating Products

The shopping cart needs products to work with, and so product entities must be created via the `seneca.make$` method.  For example, to make an apple product with code `'app01'` and price 11, you could write

```JavaScript
var product_ent  = seneca.make$('shop','product');
var apple  = product_ent.make$({
	name:'apple',
	price:11,
	code:'app01'
}).save$(function(e,o){apple=o});
```

Later, you can use the code `'app01'` to add the apple to the cart, or directly reference the `apple` variable.

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

### add_entry(options, callback)
Adds a new item to cart, creating a new cart automatically if one is not specified.
* options `Object` - an object specifying the options for adding a product entity to the entries in a shopping cart entity.  Any custom properties passed in addition to those specified will be added to the entries.
	- cart `Object` or `String` (optional) - the shopping cart entity or corresponding id to add the entry to.  If omitted, a new shopping cart entity will automatically be created.
	- product `Object` or `String` (optional) - the product entity or corresponding id to add to the shopping cart.  If omitted, the code property will be used to look up the product in the persistent product entities
	- code `String` (optional) - unique identifier code associated with the product entity.  Can be used if the property entity is omitted.
	- quantity `Number` (optional) - the number of times that product should be added to the cart.  Default is 1.
	- sort `Number` (optional) - an integer that can be used to document a particular ranking of poducts in the shopping cart.  Default is an auto-generated number that is larger for more recent entries.
* callback `Function` - takes two arguments, `err` and `out`. `out` is an object with property `cart`, which is the cart that the entry has been added to.

### remove_entry(options, callback)
Removes an entry from the cart entries based on the id of the product.
* options `Object`
	- cart `Object` or `String` - the shopping cart entity or corresponding id to remove the entry from.
	- product id `String` - the id of the product entity that should be removed from the cart's entries.
* callback `Function` - takes two arguments, `err` and `out`. `out` is an object with property `cart`, which is the cart that the entry has been removed from.

### get(options, callback)
Retrieves the cart entity based on the cart id.
* options `Object` - has one property `cart` that has the cart id string corresponding to the desired cart entity.  If the `cart` property is omitted, a new cart will be created.
* callback `Function` - takes two arguments, `err` and `out`. `out` is an object with property `cart`, which is the cart corresponding to the id.

### purchase(options, callback)
Creates a purchase entity from a given cart, closing the cart after the process is complete
* options `Object`
	- cart `Object` or `String` - cart id or entity object to create the purchase entity from.
	- buyer `Object` - An object representing a buyer, with any custom fields deemed necessary, such as `name` or `email`.
* callback `Function` - takes two arguments, `err` and `out`. `out` is an object with two properties, `cart` and `purchase`, each representing their corresponding entities.

### complete(options, callback)
A wrapper around the `purchase` command that uses the `user` plugin to automatically retrieve the user when accessed via the RESTful web API.
* options `Object`
	- user `Object` (optional) - a user object representing the user making the purchase.  The object should have properties `id`, `name` and `email`.  If `user` is omitted, the user will be detected by the `seneca-user` plugin, and used in the purchase.  If there is no user detected, the `email` parameter will be used to attempt a user login.
	- email `String` (optional) - used in place of a user object if the user object is omitted.
* callback `Function` - takes two arguments, `err` and `out`. `out` is an object with two properties, `cart` and `purchase`, each representing their corresponding entities.


Example
-------

```JavaScript
var seneca = require('seneca')()

seneca.use( 'engage' )
seneca.use( 'cart' )

var cartpin = seneca.pin({role:'cart',cmd:'*'})

var product_ent  = seneca.make$('shop','product')
var cart_ent     = seneca.make$('shop','cart')
var purchase_ent = seneca.make$('shop','purchase')

var apple  = product_ent.make$({name:'apple',price:11,code:'app01'}).save$(function(e,o){apple=o})
var orange = product_ent.make$({name:'orange',price:22,code:'ora02'}).save$(function(e,o){orange=o})

cartpin.create({custom1:'value1'},function(err,out){
  console.log(cart.status) // => 'open'
  console.log(cart.custom1) // => 'value1'

  cartpin.add_entry({code:'app01',cart:cart,entrycustom1:'entryvalue1'},function(err,out){
    var cart = out.cart
    console.log(cart.total) // => 11
    console.log(cart.entries[0]) // => {name:'apple',...}

    cartpin.purchase({cart:out.cart.id,buyer:{name:'Alice'}},function(err,out){
      console.log('out',out)
      console.log(out.cart.status) // => 'closed'
    })
  })
})

```
