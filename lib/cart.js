/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";




var _   = require('underscore')
var nid = require('nid')



module.exports = function cart( options, register ) {
  var name = "cart"

  options = this.util.deepextend({
    prefix: '/api/cart',
    add: {redirect:'/cart'},
    remove: {redirect:'/cart'}
  },options)


  var cart_ent     = this.make('shop','cart')
  var product_ent  = this.make('shop','product')
  var purchase_ent = this.make('shop','purchase')


  var add_count = 0
  var salestax_update = false


  // create a new empty cart, args can contain custom values
  // but id,created,modified,entries,total,status are set by this plugin
  this.add({role:name,cmd:'create'},function(args,done){
    var seneca = this

    var cart = cart_ent.make$()
    cart.created = cart.modified = new Date()
    cart.entries = []
    cart.total = 0
    cart.status = 'open'

    _.each( seneca.util.clean(_.omit(args, ['role','cmd','cart','id','created','modified','entries','total','status'])), function(v,k){
      cart[k]=v
    })

    cart.save$(function(err,cart){
      if( err ) return done(err);
      seneca.log.debug('create',cart.id)
      done(null,{cart:cart})
    })
  })


    
  // adds entry based on product data
  // adds entry fields id, type, sort
  // does not save cart, rather calls trigger:update action
  this.add(
    {role:name,cmd:'add_entry'},
    //{required$:['cart'],object$:['cart']},
    function(args,done){
      var seneca = this

      var cart = args.cart
      if( !cart ) {
        this.act({role:name,cmd:'create'},function(err,out){
          if( err ) return done(err);
          do_product(out.cart)
        })
      }
      else do_product(cart)

      function do_product( cart ) {
        var product = args.product

        if( !product ) {
          product_ent.load$({code:args.code},function(err,product){
            if( err ) return done(err);
            do_add(product)
          })
        }
        else do_add(product);

        function do_add(product) {
          var entry = _.extend({},product.data$(false))

          // entry fields that can be overwritten
          entry.sort = 1000*(new Date().getTime()%1000000000)+(add_count++)
          entry.quantity = 1

          // custom and overwrite
          _.each( seneca.util.clean(_.omit(args, ['role','cmd','cart'])), function(v,k){
            entry[k]=v
          })

          // controlled fields
          entry.id = nid()
          entry.type = 'product'

          seneca.log.debug('add/product',cart.id,entry)
          cart.entries.push(entry)
          seneca.act({role:name,trigger:'update',cart:cart},done)
        }
      }
    })


  // removes an entry by id
  // cals trigger:update action
  this.add({role:name,cmd:'remove_entry'},function(args,done){
    var seneca = this

    var cart = args.cart

    var removed_entry
    cart.entries = _.filter(cart.entries,function(entry){
      if( entry.id == args.entry ) {
        removed_entry = entry
        return false
      }
      else return true
    })

    seneca.log.debug('remove/entry',cart.id,'entry:',args.entry,removed_entry)
    seneca.act({role:name,trigger:'update',cart:cart},done)
  })


  /*
   
    THIS WON"T WORK - REDESIGN

  this.add({role:name,cmd:'salestax'},function(args,done){
    var cart = args.cart

    var salestax = _.filter(cart.entries,function(entry){return 'salestax'==entry.type})[0]
    if( !salestax ) {
      salestax = {
        name:'Sales Tax',
        type:'salestax',
        rate:args.rate,
        footer:true
      }
      cart.entries.push(salestax)
    }


    this.log.debug('add/salestax',cart.id,salestax)
    
    if( !salestax_update ) {
      this.add({role:name,trigger:'update'},function(args,cb){
        var cart = args.cart

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
  */


  this.add({role:name,trigger:'update'},function(args,done){
    var seneca = this
    var cart = args.cart

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
      done(null,{cart:cart})
    })
  })


  // get cart entity from cart id via ensure_entity wrapper
  // also for http api
  this.add({role:name,cmd:'get'},function(args,done){
    var create = void 0==args.create || args.create
    if( args.cart || !create ) {
      done(null,{cart:args.cart})
    }
    else {
      this.act({role:name,cmd:'create'},done)
    }
  })


  this.add({role:name,cmd:'purchase'},function(args,done){
    var seneca = this
    
    var cart = args.cart

    var purchase = purchase_ent.make$()
    purchase.created = purchase.modified = new Date()
    purchase.cart = cart.id

    // TODO: need to be able to set set fields as will add product entry

    // this is not really satisfactory as we migth want to search on purchaser email address etc
    purchase.data = cart.data$()
    purchase.buyer = args.buyer

    purchase.save$(function(err,purchase){
      if( err ) return done(err);

      cart.status = 'closed'
      cart.save$(function(err,cart){
        if( err ) return done(err);
        
        seneca.log.debug('purchase',purchase.id,'cart:',cart.id,'total:',cart.total,'size:',cart.entries.length,'buyer',purchase.buyer)
        done(null,{cart:cart,purchase:purchase})
      })
    })
  })


  // TODO: needs more work
  this.add({role:name,cmd:'complete'},function(args,done){
    var seneca = this

    // TODO: this user stuff should happen in a trigger
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

      var cart = args.cart

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
    prefix:options.prefix,
    pin:{role:name,cmd:'*'},
    map:{
      add_entry:    {POST:{redirect:(options.add?options.add.redirect:null)}},
      remove_entry: {POST:{redirect:(options.remove?options.remove.redirect:null)}},
      get:      {GET:{filter:['id','$']}},
      complete: {POST:{redirect:(options.complete?options.complete.redirect:null)}},
    }
  })

  register(null,{
    name:name,
    service:service
  })
}
