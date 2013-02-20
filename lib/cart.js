/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";




var _   = require('underscore')
var nid = require('nid')



module.exports = function cart( seneca, options, register ) {
  var name = "cart"

  var engagement = seneca.hasact({role:'engage',info:true}) ? seneca.pin({role:'engage',cmd:'*'}) : null

  options = seneca.util.deepextend({
    engage: !!engagement,
    add: {redirect:'/cart'},
    remove: {redirect:'/cart'}
  },options)

  
  var cart_ent    = seneca.make('shop','cart')
  var product_ent = seneca.make('shop','product')


  var add_count = 0


  // args.context can store cartid - context could req.session obj for e.g.
  // or else store it in an engagement
  function getcart(args,done,win) {
    if( args.cart && args.cart.$ ) return done(null,args.cart);

    var autocreate = void 0 == args.create ? true : args.create
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
        if( autocreate ) {
          var cart = cart_ent.make$()
          cart.created = cart.modified = new Date()
          cart.entries = []
          cart.total = 0
          cart.save$(function(err,cart){
            if( err ) return done(err);
            if( cart ) {
              seneca.log.debug(args.actid$,'create',cart.id)
              return do_win(cart);
            }
          })
        }
        else return win(null);
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

        var entry = {
          id:nid(),
          product:product.code||product.id,
          name:product.name,
          price:product.price,
          type:'product',
          order:1000*(new Date().getTime()%1000000000)+(add_count++),
          data:product.data$(false)
        }

        seneca.log.debug(args.actid$,'add/product',cart.id,entry)

        cart.entries = cart.entries || []
        cart.entries.push(entry)
        seneca.act({role:name,trigger:'update',cartid:cart.id},done)
      })
    })
  })


  seneca.add({role:name,cmd:'remove'},function(args,done){
    getcart(args,done,function(cart){
      cart.entries = cart.entries || []
      cart.entries = _.filter(cart.entries,function(entry){
        return entry.id != args.entry
      })

      seneca.log.debug(args.actid$,'remove/entry',cart.id,'entry:',args.entry)
      seneca.act({role:name,trigger:'update',cartid:cart.id},done)
    })
  })


  seneca.add({role:name,cmd:'salestax'},function(args,done){
    getcart(args,done,function(cart){
      cart.entries = cart.entries || []
      var salestax = _.filter(cart.entries,function(entry){return 'salestax'==entry.type})[0]
      if( !salestax ) {
        salestax = {
          name:'Sales Tax',
          type:'salestax',
          rate:args.rate,
          footer:true
        }
      }
      cart.entries.push(salestax)

      seneca.log.debug(args.actid$,'add/salestax',cart.id,salestax)

      seneca.add({role:name,trigger:'update'},function(args,cb){
        var total = 0
        cart.entries.forEach(function(entry){
          if( _.isNumber(entry.price) && 'salestax'!=entry.type) {
            total+=entry.price
          }
        })
        salestax.price = salestax.rate * total

        seneca.log.debug(args.actid$,'update/salestax',cart.id,'net:',total,'rate:',salestax.rate,'tax:',salestax.price)

        args.parent$(args,cb)
      })

      seneca.act({role:name,trigger:'update',cartid:cart.id},done)
    })
  })


  seneca.add({role:name,trigger:'update'},function(args,done){
    var cartid = args.cartid

    cart_ent.load$(cartid,function(err,cart){
      if( err ) return done(err);
      if( !cart ) {
        seneca.fail({code:'cart/not-found',args:args},done)
      }

      cart.entries = cart.entries.sort(function(a,b){
        if( a.inserted && b.inserted ) {
          return b.inserted - a.inserted
        }
        else if( a.footer ) {
          return 1
        }
        else if( b.footer ) {
          return -1
        }
        else {
          return 0
        }
      })

      var total = 0
      cart.entries.forEach(function(entry){
        if( _.isNumber(entry.price) ) {
          total+=entry.price
        }
      })
      cart.total = total
     
      seneca.log.debug(args.actid$,'update/total',cart.id,'total:',cart.total,'size:',cart.entries.length)

      cart.modified = new Date()
      cart.save$(function(err,cart){
        if( err ) return done(err);
        done(null,cart.id)
      })
    })
  })


  seneca.add({role:name,cmd:'table'},function(args,done){
    getcart(args,done,function(cart){
      var table = cart ? cart.data$() : null
      done(null,table)
    })
  })



  var service = seneca.http({
    prefix:'/api/cart',
    pin:{role:name,cmd:'*'},
    map:{
      add:    {POST:{redirect:(options.add?options.add.redirect:null)}},
      remove: {POST:{redirect:(options.remove?options.remove.redirect:null)}},
      table: {},
    }
  })

  register(null,{
    name:name,
    service:service
  })
}
