import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import assert from 'assert'
import path from 'path'

import './mk-catalog.html';

const TP = Template['mk-catalog'];

TP.onCreated(function(){
  this.catlist = new ReactiveVar();
  this.cat_index = new ReactiveVar();
})

TP.onRendered(function(){
  const tp = this;
  console.log(`onRendered`)
  Meteor.call('cat-list',{},(err,catlist)=>{
    if (err) throw 'fatal@14';
    console.log(`@17`,{catlist})
    tp.catlist.set(catlist);
    reset_frozen(tp,false); // has no effect.
  })
  Meteor.call('ls-cat',null,(err,cat_index)=>{
    if (err) throw 'fatal@26';
    console.log(`@27`,{cat_index})
    console.log({cat_index})
    tp.cat_index.set(cat_index);
    reset_frozen(tp,false); // has no effect.
  })
})

TP.helpers({
  catlist: ()=>{
    const tp = Template.instance();
    console.log(`helper catlist:`,tp.catlist)
    const catlist = tp.catlist.get();
    console.log(`helper catlist`,{catlist})
    if (!catlist) return;
    console.log(`helper catlist`,{catlist})
    return catlist.map(catNo => ({catNo, mtime: new Date()}));
  },
  catlist2: ()=>{
    const tp = Template.instance();
    console.log(`helper catlist:`,tp.cat_index.get())
    const cat_index = tp.cat_index.get();
    console.log(`helper catlist`,{cat_index})
    if (!cat_index) return;
    console.log(`helper catlist`,{cat_index})
    const list = Object.keys(cat_index).map(catNo =>{
      return {catNo, mtime:cat_index[catNo].mtime}
    })
    console.log(`helper:`, {list})
    return list;
  }
})

/*
    WHEN DIV FROZEN
    they will not respond to click.
    events are blocked.
*/

function reset_frozen(tp, b) {
  tp.findAll('div.js-cat-btn').forEach(div =>{
    if (b) div.classList.add('frozen')
    else div.classList.remove('frozen')
  })
}

function reset_running(tp, catNo='00') {
  tp.findAll('div.js-cat-btn').forEach(div =>{
    if (div.attributes['catNo'].value == catNo)
      div.classList.add('running')
    else
      div.classList.remove('running')
  })
}



TP.events({
  'click .js-cat-btn': async (e,tp)=>{
    if (e.target.classList.contains('frozen')) return;

    const [catNo,lang] = e.target.attributes['catNo'].value.split('/');
    console.log(`click js-cat.btn catNo:${catNo}/${lang}`)
//    console.log(e.target.classList)
//    console.log(`click js-cat.btn2`)
    reset_frozen(tp,true);
    reset_running(tp,catNo)
    Session.set('np-status',`processing <${catNo}/${lang}> please wait...`)
    Session.set('np-status-color','orange')
    const retv1 = await mk1_catalog(catNo,lang)
    if (!retv1.error) {
      console.log(`resync (${catNo}/${lang}) success.`)
      Session.set('np-status','done - success')
      Session.set('np-status-color','green')
    } else {
      console.log({retv1});
      //console.log(`resync (${catNo}/${lang}) alert:`,retv1.log)
      Session.set('np-status','FAIL')
      Session.set('np-status-color','red')
    }

    /**
    //    UPDATE THE CACHE.
    **/
    const {catNo:catNo_, mtime} = retv1;
    assert(catNo == catNo_)
    const cat_index = tp.cat_index.get()
    cat_index[catNo].mtime = mtime;
    tp.cat_index.set(cat_index)


    reset_frozen(tp,false)
    reset_running(tp)
  }
})

TP.events({
  'click .js-resync-btn': async (e,tp)=>{
    const verbose =0;
    if (e.target.classList.contains('frozen')) return;

    const [catNo,lang] = e.target.attributes['catNo'].value.split('/');
    ;(verbose >0) && console.log(`click js-resync.btn1 catNo:${catNo}`)
//    console.log(e.target.classList)
//    console.log(`click js-cat.btn2`)
    reset_frozen(tp,true);
    reset_running(tp,catNo);
    Session.set('np-status','running please wait...')
    const retv1 = await resync_np_page(catNo,lang); //  page-product
    if (!retv1.error && retv1.log.length<=0) {
      console.log(`resync (${catNo}/${lang}) success.`)
      Session.set('np-status','done - success')
    } else {
      console.log({retv1});
      //console.log(`resync (${catNo}/${lang}) alert:`,retv1.log)
      Session.set('np-status','fail')
    }

    /**
    //    UPDATE mtime in CACHE.
    **/

    if (false) {
      const {catNo:catNo_, mtime} = retv1;
      assert(catNo == catNo_)
      const cat_index = tp.cat_index.get()
      cat_index[catNo].mtime = mtime;
      tp.cat_index.set(cat_index)
    }

    reset_frozen(tp,false)
    reset_running(tp)
  }
})



async function mk_catalogs(tp) {
  console.log(`todo:`,tp.catlist.get())
  for (catNo of tp.catlist.get()) {
    console.log(`-- doing catNo:${catNo} ...`)

    reset_frozen(tp,true);
    reset_running(tp,catNo)

    const retv1 = await mk1_catalog(catNo,'en')
    console.log({retv1})
    if (true) {
      const {catNo:catNo_, mtime} = retv1;
      assert(catNo == catNo_)
      const cat_index = tp.cat_index.get()
      cat_index[catNo].mtime = mtime;
      tp.cat_index.set(cat_index)
    }

    const retv2 = await mk1_catalog(catNo,'th')
    console.log({retv2})
    if (true) {
      const {catNo:catNo_, mtime} = retv2;
      assert(catNo == catNo_)
      const cat_index = tp.cat_index.get()
      cat_index[catNo].mtime = mtime;
      tp.cat_index.set(cat_index)
    }
    console.log(`-- catNo:${catNo} done.`)
  }

  reset_frozen(tp,false);
  reset_running(tp)

  console.log(`all catalogs done.`)
}

async function mk1_catalog(catNo,lang) {
  return new Promise((resolve,reject)=>{
    Meteor.call('mk1-catalog',{catNo,lang, dry_run:false},(err,retv)=>{
      if (err) reject(err);
      resolve(retv)
    })
  })
}


async function resync_np_page(catNo,lang) {
  return new Promise((resolve,reject)=>{
    Meteor.call('resync-np-page',{catNo,lang},(err,retv)=>{
      if (err) reject(err);
      resolve(retv)
    })
  })
}



TP.events({
  'click button': (e,tp)=>{
    mk_catalogs(tp); // async !
  }

/*
    Meteor.call(`mk-catalog`,{catNo:19, lang:'en'}, (err,retv) =>{
      if (err) console.log({err})
      console.log({retv})
    })
  */
})

// ---------------------------------------------------------------------------

FlowRouter.route('/mk-catalog', {
  action: function(params, queryParams){
        //console.log('Router::action for: ', FlowRouter.getRouteName());
        //console.log(' --- params:',params);
    BlazeLayout.render('mk-catalog',params);
  }
});
