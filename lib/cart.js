/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";




var _   = require('underscore')
var nid = require('nid')



module.exports = function cart( seneca, options, register ) {
  var name = "cart"

  var engagement = seneca.hasact({role:'engage',info:true}) ? seneca.pin({role:'engage',cmd:'*'}) : null

  options = seneca.util.deepextend({
    engage: !!engagement,
    add: {redirect:'/cart'}
  },options)

  
  var cart_ent    = seneca.make('shop','cart')
  var product_ent = seneca.make('shop','product')


  // args.context can store cartid - context could req.session obj for e.g.
  // or else store it in an engagement
  function getcart(args,done,win) {
    if( args.cart && args.cart.$ ) return done(null,args.cart);

    var cartid = args.cart || (args.context && args.context.cartid )

    if( !cartid && options.engage ) {
      engagement.get({key:'cartid',context:args.context,req:args.req,res:args.res},function(err,cartid){
        if(err) return done(err);
        ensure_cart(cartid)
      })
    }
    else return ensure_cart(cartid);


    function ensure_cart(cartid) {
      if( cartid ) {
        cart_ent.load$(cartid,function(err,cart){
          if( err ) return done(err);
          if( cart ) return do_win(cart);
          seneca.fail({code:'cart/not-found',args:args},done)
        })
      }
      else {
        var cart = cart_ent.make$()
        cart.created = cart.modified = new Date()
        cart.save$(function(err,cart){
          if( err ) return done(err);
          if( cart ) return do_win(cart);
        })
      }
    }

    function do_win(cart) {
      if( args.context ) {
        args.context.cartid = cart.id
      }
      if( options.engage ) {
        engagement.set({key:'cartid',value:cart.id,context:args.context,req:args.req,res:args.res},function(err){
          if(err) return done(err);
          return win(cart)
        })
      }
      else return win(cart);
    }
  }


  seneca.add({role:name,cmd:'add'},function(args,done){
    getcart(args,done,function(cart){
      var q = args.product ? {id:product} : args.code ? {code:args.code} : null
      product_ent.load$(q,function(err,product){
        if( err ) return done(err);

        var entry = {id:nid(),product:product.code||product.id,data:product.data$(false)}
        cart.entries = cart.entries || []
        cart.entries.push(entry)
        cart.modified = new Date()
        cart.save$(function(err,cart){
          if( err ) return done(err);
          done(null,cart.id)
        })
      })
    })
  })

  seneca.add({role:name,cmd:'table'},function(args,done){
    getcart(args,done,function(cart){
      done(null,{entries:cart.entries||[]})
    })
  })



  var service = seneca.http({
    prefix:'/api/cart',
    pin:{role:name,cmd:'*'},
    map:{
      add: {POST:{redirect:(options.add?options.add.redirect:null)}},
      table: {},
    }
  })

  register(null,{
    name:name,
    service:service
  })
}
