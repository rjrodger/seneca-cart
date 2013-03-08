/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";




var _   = require('underscore')
var nid = require('nid')



module.exports = function cart( options, register ) {
  var name = "cart"

  options = this.util.deepextend({
    add: {redirect:'/cart'},
    remove: {redirect:'/cart'}
  },options)


  var cart_ent     = this.make('shop','cart')
  var product_ent  = this.make('shop','product')
  var purchase_ent = this.make('shop','purchase')


  var add_count = 0


  function ensurecart(seneca,args,done,win) {
    if( args.cart ) return done.call(seneca,null,args.cart);

    var cart = cart_ent.make$()
    cart.created = cart.modified = new Date()
    cart.entries = []
    cart.total = 0
    cart.status = 'open'
    cart.save$(function(err,cart){
      if( err ) return done.call(seneca,err);
      seneca.log.debug('create',cart.id,why)
      win.call(seneca,cart)
    })
  }


  this.add({role:name,cmd:'add'},function(args,done){
    var seneca = this
    ensurecart(seneca,args,done,function(cart){
      var q = args.product ? {id:product} : args.code ? {code:args.code} : null
      product_ent.load$(q,function(err,product){
        if( err ) return done(err);

        var entry = {
          id:nid(),
          product:product.code||product.id,
          name:product.name,
          price:product.price,
          type:'product',
          category:product.category,
          order:1000*(new Date().getTime()%1000000000)+(add_count++),
          data:product.data$(false)
        }

        seneca.log.debug('add/product',cart.id,entry)

        cart.entries = cart.entries || []
        cart.entries.push(entry)
        seneca.act({role:name,trigger:'update',cartid:cart.id},done)
      })
    })
  })


  this.add({role:name,cmd:'remove'},function(args,done){
    var seneca = this
    ensurecart(seneca,args,done,function(cart){
      cart.entries = cart.entries || []
      cart.entries = _.filter(cart.entries,function(entry){
        return entry.id != args.entry
      })

      seneca.log.debug('remove/entry',cart.id,'entry:',args.entry)
      seneca.act({role:name,trigger:'update',cartid:cart.id},done)
    })
  })


  this.add({role:name,cmd:'salestax'},function(args,done){
    ensurecart(this,args,done,function(cart){
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

      this.log.debug('add/salestax',cart.id,salestax)

      this.add({role:name,trigger:'update'},function(args,cb){
        var total = 0
        cart.entries.forEach(function(entry){
          if( _.isNumber(entry.price) && 'salestax'!=entry.type) {
            total+=entry.price
          }
        })
        salestax.price = salestax.rate * total

        this.log.debug('update/salestax',cart.id,'net:',total,'rate:',salestax.rate,'tax:',salestax.price)

        this.parent(args,cb)
      })

      this.act({role:name,trigger:'update',cartid:cart.id},done)
    })
  })


  this.add({role:name,trigger:'update'},function(args,done){
    var seneca = this
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
     
      seneca.log.debug('update/total',cart.id,'total:',cart.total,'size:',cart.entries.length)

      cart.modified = new Date()
      cart.save$(function(err,cart){
        if( err ) return done(err);
        done(null,cart.data$())
      })
    })
  })


  this.add({role:name,cmd:'table'},function(args,done){
    ensurecart(this,args,done,function(cart){
      var table = cart ? cart.data$() : null
      done(null,table)
    })
  })


  this.add({role:name,cmd:'purchase'},function(args,done){
    var seneca = this
    ensurecart(seneca,args,done,function(cart){
      var purchase = purchase_ent.make$()
      purchase.created = purchase.modified = new Date()
      purchase.cart = cart.id
      purchase.data = cart.data$()
      purchase.buyer = args.buyer

      purchase.save$(function(err,purchase){
        if( err ) return done(err);

        cart.status = 'closed'
        cart.save$(function(err,cart){
          if( err ) return done(err);

          seneca.log.debug('purchase',purchase.id,'cart:',cart.id,'total:',cart.total,'size:',cart.entries.length,'buyer',purchase.buyer)
          done(null,{cart:cart.id,purchase:purchase.id})
        })
      })
    })
  })


  // TODO: needs more work
  this.add({role:name,cmd:'complete'},function(args,done){
    var seneca = this
    var user = args.user
    if( !user ) {
      user = args.req$ && args.req$.seneca && args.req$.seneca.user

      if( !user ) {

        // auto register and login
        if( args.email ) {
          this.act({role:'user',cmd:'register',nick:args.email,email:args.email,name:args.email,active:true},function(err,user){
            this.act({role:'user',cmd:'login',nick:args.email,auto:true},function(err,out){
              this.act({role:'auth',cmd:'login',user:out.user,login:out.login},function(err,res){
                return complete(out.user)
              })
            })
          })
        }

      }
    }
    return complete(user);

    function complete(user) {
      var buyer = {user:user.id,email:user.email,name:user.name}
      seneca.act({role:name,cmd:'purchase',buyer:buyer},done)
    }
  })


  if( _.isArray(options.onlyone) ) {
    this.add({role:name,trigger:'update'},function(args,cb){
      var seneca = this
      var cartid = args.cartid

      cart_ent.load$(cartid,function(err,cart){
        if( err ) return done(err);
        if( !cart ) {
          seneca.fail({code:'cart/not-found',args:args},done)
        }

        var last = {}
        var newentries = []
        cart.entries = cart.entries || []
        cart.entries.forEach(function(entry){
          if( _.contains(options.onlyone,entry.category) ) {
            last[entry.category] = entry
          }
          else {
            newentries.push(entry)
          }
        })
        for( var category in last ) {
          newentries.push(last[category])
        }

        cart.entries = newentries
        cart.save$( function(err,cart){
          seneca.log.debug('update/onlyone',cart.id,_.keys(last))
          seneca.parent(args,cb)
        })
      })
    })
  }


  // ensure args.{cart,product,purchase} is a valid entity
  // loads ent if value is just an id
  this.act({
    role:'util',
    cmd:'ensure_entity',
    pin:{role:'cart',cmd:'*'},
    entmap:{
      cart:cart_ent,
      product:product_ent,
      purchase:purchase_ent
    }
  })


  var service = this.http({
    prefix:'/api/cart',
    pin:{role:name,cmd:'*'},
    map:{
      add:    {POST:{redirect:(options.add?options.add.redirect:null)}},
      remove: {POST:{redirect:(options.remove?options.remove.redirect:null)}},
      table: {},
      complete: {POST:{redirect:(options.complete?options.complete.redirect:null)}},
    }
  })

  register(null,{
    name:name,
    service:service
  })
}
