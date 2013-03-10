/* Copyright (c) 2013 Richard Rodger */
"use strict";

// mocha engage.test.js



var assert  = require('chai').assert
var util    = require('util')


var _  = require('underscore')
var gex  = require('gex')


var seneca = require('seneca')()

seneca.use( 'engage' )
seneca.use( require('..') )


var cartpin = seneca.pin({role:'cart',cmd:'*'})

var product_ent  = seneca.make$('shop','product')
var cart_ent     = seneca.make$('shop','cart')
var purchase_ent = seneca.make$('shop','purchase')

var apple  = product_ent.make$({name:'apple',price:11,code:'app01'}).save$(function(e,o){apple=o})
var orange = product_ent.make$({name:'orange',price:22,code:'ora02'}).save$(function(e,o){orange=o})


function squish(obj) { return util.inspect(obj).replace(/\s+/g,'') }


describe('engage', function() {
  
  it('version', function() {
    assert.ok(gex(seneca.version),'0.5.*')
  }),


  it('happy', function() {
    cartpin.create({custom1:'value1'},function(err,cart){
      assert.isNull(err)
      assert.isNotNull(cart)
      assert.ok(cart.entity$)
      assert.equal('open',cart.status)
      assert.equal('value1',cart.custom1)

      // CHECK: this passed through ent methods
      cartpin.add_entry({code:'app01',cart:cart,entrycustom1:'entryvalue1'},function(err,cart){
        assert.isNull(err)
        assert.isNotNull(cart)
        assert.ok(cart.entity$)
        assert.equal('open',cart.status)
        assert.equal(11,cart.total)
        assert.equal('entryvalue1',cart.entries[0].entrycustom1)
        assert.ok(gex("{name:'apple',price:11,code:'app01',id:'*',sort:*,quantity:1,entrycustom1:'entryvalue1',type:'product'}")
                  .on(squish(cart.entries[0])))
      })
    })
  })


  it('auto-create', function() {
    cartpin.add_entry({code:'app01'},function(err,cart){
      assert.isNull(err)
      assert.isNotNull(cart)
      assert.ok(cart.entity$)
      assert.equal('open',cart.status)
      assert.equal(11,cart.total)
      assert.equal(1,cart.entries.length)
      assert.equal('app01',cart.entries[0].code)
    })
  })


/*
  it('salestax', function() {
    var mycart
    cart.add({code:'ora02'},function(err,cartid){
      assert.ok(null==err)
      assert.ok(null!=cartid)
      mycart = cartid

      cart.add({cart:cartid,code:'app01'},function(err,cartid){
        assert.ok(null==err)
        assert.equal(mycart,cartid)


        cart.table({cart:cartid},function(err,table){
          assert.equal(2,table.entries.length)
          assert.equal(3,table.total)
          
          cart.salestax({cart:cartid,rate:0.23},function(err,cartid){
            assert.ok(null==err)
            assert.equal(mycart,cartid)

            cart.table({cart:cartid},function(err,table){
              //console.log(util.inspect(table))
              assert.equal(3,table.entries.length)
              assert.equal('salestax',table.entries[2].type)
              assert.equal(3.69,table.total)


              cart.add({cart:cartid,code:'ora02'},function(err,cartid){
                assert.ok(null==err)
                assert.equal(mycart,cartid)

                cart.table({cart:cartid},function(err,table){
                  //console.log(util.inspect(table))
                  assert.equal(4,table.entries.length)
                  assert.equal('salestax',table.entries[3].type)
                  assert.equal(6.15,table.total)
                })
              })
            })
          })
        })
      })
    })
  })
  */

  it('purchase', function() {
    var mycart
    cartpin.add_entry({code:'ora02'},function(err,cart){
      assert.ok(null==err)
      assert.ok(null!=cart)
      mycart = cart

      cartpin.add_entry({cart:cart,code:'app01'},function(err,cart){
        assert.ok(null==err)
        assert.equal(mycart.id,cart.id)

        cart_ent.load$(cart.id,function(err,thecart){
          assert.ok(null==err)
          assert.equal('open',thecart.status)

          cartpin.purchase({cart:cart,buyer:{name:'Alice'}},function(err,out){
            assert.ok(null==err)
            //console.log('out',out)
            assert.equal(33,out.cart.total)

            cart_ent.load$(out.cart.id,function(err,thecart){
              assert.ok(null==err)
              assert.equal('closed',thecart.status)

              purchase_ent.load$(out.purchase.id,function(err,thepurchase){
                assert.ok(null==err)
                //console.log(thepurchase)
                assert.equal(out.cart.id,thepurchase.cart)
              })
            })
          })
        })
      })
    })
  })

})
