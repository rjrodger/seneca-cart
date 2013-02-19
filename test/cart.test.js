/* Copyright (c) 2013 Richard Rodger */
"use strict";

// mocha engage.test.js



var assert  = require('assert')
var util    = require('util')


var _  = require('underscore')
var gex  = require('gex')


var seneca = require('seneca')()

seneca.use( require('..') )


var cart = seneca.pin({role:'cart',cmd:'*'})

var product_ent = seneca.make$('shop','product')
var apple  = product_ent.make$({name:'apple',price:1,code:'app01'}).save$(function(e,o){apple=o})
var orange = product_ent.make$({name:'orange',price:2,code:'ora02'}).save$(function(e,o){orange=o})


describe('engage', function() {
  
  it('version', function() {
    assert.ok(gex(seneca.version),'0.5.*')
  }),


  it('happy', function() {
    cart.add({code:'app01'},function(err,cartid){
      assert.ok(null==err)
      assert.ok(null!=cartid)
      assert.ok(_.isString(cartid))

      cart.table({cart:cartid},function(err,table){
        assert.ok(null==err)
        assert.ok(null!=table)
        assert.ok(null!=table.entries)
        assert.ok(_.isArray(table.entries))
        console.log(util.inspect(table,false,5))
      })
    })
  })

  
})
