/* Copyright (c) 2013 Richard Rodger */
"use strict";

// mocha engage.test.js



var assert  = require('assert')
var util    = require('util')


var _  = require('underscore')
var gex  = require('gex')


var seneca = require('seneca')()

seneca.use( 'engage' )
seneca.use( require('..') )


var cart = seneca.pin({role:'cart',cmd:'*'})

var product_ent  = seneca.make$('shop','product')
var cart_ent     = seneca.make$('shop','cart')
var purchase_ent = seneca.make$('shop','purchase')

var apple  = product_ent.make$({name:'apple',price:1,code:'app01'}).save$(function(e,o){apple=o})
var orange = product_ent.make$({name:'orange',price:2,code:'ora02'}).save$(function(e,o){orange=o})


function squish(obj) { return util.inspect(obj).replace(/\s+/g,'') }


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
        assert.equal(1,table.entries.length)
        //console.log(squish(table.entries[0]))
        assert.ok(gex("{id:'*',product:'app01',name:'apple',price:1,type:'product',order:*,data:*}")
                  .on(squish(table.entries[0])))
      })
    })
  })


  it('context', function() {
    var ctxt = {}
    cart.add({code:'ora02',context:ctxt},function(err,cartid){
      assert.ok(null==err)
      assert.ok(null!=cartid)
      assert.ok(_.isString(cartid))

      cart.table({context:ctxt},function(err,table){
        assert.ok(null==err)
        assert.ok(null!=table)
        assert.ok(null!=table.entries)
        assert.ok(_.isArray(table.entries))
        assert.equal(1,table.entries.length)
        //console.log(squish(table.entries[0]))
        assert.ok(gex("{id:'*',product:'ora02',name:'orange',price:2,type:'product',order:*,data:*}")
                  .on(squish(table.entries[0])))
      })
    })
  })


  it('reqres', function() {
    var req = {}, res = {cookie:function(k,v){req.seneca={engage_token:v}}}
    cart.add({code:'ora02',req$:req,res$:res},function(err,cartid){
      assert.ok(null==err)
      assert.ok(null!=cartid)
      assert.ok(_.isString(cartid))

      cart.table({req$:req,res$:res},function(err,table){
        assert.ok(null==err)
        assert.ok(null!=table)
        assert.ok(null!=table.entries)
        assert.ok(_.isArray(table.entries))
        assert.equal(1,table.entries.length)
        console.log(squish(table.entries[0]))
        assert.ok(gex("{id:'*',product:'ora02',name:'orange',price:2,type:'product',order:*,data:*}")
                  .on(squish(table.entries[0])))
      })
    })
  })


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


  it('purchase', function() {
    var mycart
    cart.add({code:'ora02'},function(err,cartid){
      assert.ok(null==err)
      assert.ok(null!=cartid)
      mycart = cartid

      cart.add({cart:cartid,code:'app01'},function(err,cartid){
        assert.ok(null==err)
        assert.equal(mycart,cartid)

        cart_ent.load$(cartid,function(err,thecart){
          assert.ok(null==err)
          assert.equal('open',thecart.status)

          cart.purchase({cart:cartid,buyer:{name:'Alice'}},function(err,out){
            assert.ok(null==err)
            //console.log('out',out)

            cart_ent.load$(out.cart,function(err,thecart){
              assert.ok(null==err)
              assert.equal('closed',thecart.status)

              purchase_ent.load$(out.purchase,function(err,thepurchase){
                assert.ok(null==err)
                //console.log(thepurchase)
                assert.equal(out.cart,thepurchase.cart)
              })
            })
          })
        })
      })
    })
  })

  
})
