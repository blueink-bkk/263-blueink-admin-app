import { Meteor } from 'meteor/meteor';
import assert from 'assert';
const s3 = require('264-aws-s3')(process.env)
import {CatalogBuilder} from './lib/mk-catalog.js'
const yaml = require('js-yaml')
import catIndex from './lib/indexp-cache.js'

Meteor.startup(async () => {
  // code to run on server at startup
  await catIndex.load('s3://blueink/index-np.yaml')
//  console.log({catIndex})
});

// -------------------------------------------------------------------------

async function mk_sitemap(o) {
  const {opCode, s3fn, verbose=1} = o;
  let {data} = o;

  if (!data || data.length<=0) {
    console.log(`@20 mk-sitemap`,{data})
    return {error:'missing-data'}
  }

  const _etime = new Date().getTime();
  const xlsx = JSON.parse(data);
  ;(verbose >0) && console.log(`@22`,{xlsx})

  if (s3fn.endsWith('.yaml')) {
    /**
    //    CONVERT JSON : ARRAY : YAML
    **/
    const xlsx = JSON.parse(data);
    const mp = yaml.dump(xlsx);
    console.log(mp)
    const retv1 = await s3.putObject(s3fn, data)
    console.log(`@32 mk-sitemap <${s3fn}>`,{retv1})
  } else {
    const retv1 = await s3.putObject(s3fn, xlsx)
    ;(verbose >0) && console.log(`@35 mk-sitemap <${s3fn}>`,{retv1})
  }

  /**
  //    CREATE HTML
  **/

  let html = xlsx.map(row =>{
    const {lineNo, url, en, error} = row;
    return `
    <div class="sitemap-entry" title="xlsx-${lineNo+1}">
    <a href="${url}">${en}</a> ${(error)?`<b style="color:red;font-size:12pt;">${error}</b>`:''}
    </div>
    `
  })

  html = `
<html>
<head>
<meta http-equiv="Content-Language" content="en" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
</head>

<body>
<h4>timeStamp: ${new Date().toLocaleString('en-US',{timeZone:'Asia/Bangkok'})}</h4>
${html.join('\n')}
</body>
</html>
`;


  const s3fn_en = 's3://blueink/dkz/sitemap-en.html'
  const retv1 = await s3.putObject(s3fn_en, html)
  console.log(`@35 mk-sitemap <${s3fn_en}>`,{retv1})

  let html_th = xlsx.map(row =>{
    const {lineNo, url, th, error} = row;
    return `
    <div class="sitemap-entry" title="xlsx-${lineNo+1}">
    <a href="${url}">${th}</a> ${(error)?`<b style="color:red;font-size:12pt;">${error}</b>`:''}
    </div>
    `
  })


  html_th = `
<html>
<head>
<meta http-equiv="Content-Language" content="th" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
</head>

<body>
<h4>timeStamp: ${new Date().toLocaleString('en-US',{timeZone:'Asia/Bangkok'})}</h4>
${html_th.join('\n')}
</body>
</html>
`;


  const s3fn_th = 's3://blueink/dkz/sitemap-th.html';
  const retv2 = await s3.putObject(s3fn_th, html_th)
  console.log(`@35 mk-sitemap <${s3fn_th}>`,{retv2})

  await mk_sitemap_url(xlsx);
  console.log(`@104 calling mk-sitemap-txt...`)
  await mk_sitemap_txt(xlsx);

  const retv = {status:'ok'}
  ;(verbose >0) && console.log(`@106 exit mk-sitemap ok `,{retv})
  return retv;
} // mk-sitemap


async function mk_sitemap_txt(xlsx) {
  const s3fn = 's3://blueink/sitemap.txt'
  console.log(`@113 mk-sitemap-txt <${s3fn}>.....`)

  /*
  let txt = xlsx.map(row =>{
    const {lineNo, url, en, error} = row;
    return url;
  })*/

  const v = xlsx.map(row => row.url);
  console.log(`@123`,{v})
  const retv1 = await s3.putObject(s3fn, v.join('\n'))
  console.log(`@121 mk-sitemap-txt <${s3fn}>`,{retv1})

  return {};
}


async function mk_sitemap_url(xlsx) {
  let html = xlsx.map(row =>{
    const {lineNo, url, en, error} = row;
    return `
    <div class="sitemap-entry" title="xlsx-${lineNo+1}">
    <a href="${url}">${url}</a> ${(error)?`<b style="color:red;font-size:12pt;">${error}</b>`:''}
    </div>
    `
  })

  html = `
<html>
<head>
<meta http-equiv="Content-Language" content="en" />
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
</head>

<body>
<h4>timeStamp: ${new Date().toLocaleString('en-US',{timeZone:'Asia/Bangkok'})}</h4>
${html.join('\n')}
</body>
</html>
`;


  const s3fn = 's3://blueink/dkz/sitemap-url-en.html'
  const retv1 = await s3.putObject(s3fn, html)
  console.log(`@35 mk-sitemap-url <${s3fn}>`,{retv1})

  return {};
}


Meteor.methods({
  'mk-sitemap': async (o)=>{
    try {
      await mk_sitemap(o)
      return {status:'ok'}
    }
    catch(error) {
      console.log(`ALERT@174`,{error})
      return {error}
    }
  }
});

Meteor.methods({
  'xid-lookup': async (iSeq)=>{
    if (typeof iSeq === 'string') {iSeq = parseInt(iSeq)}
    if (!Number.isInteger(iSeq)) {
      return {error: `invalid iSeq <${iSeq}>`}
    }


    const ls = await s3.ls(`s3://blueink/np14/${iSeq}-`)
    console.log(`@115 xid-lookup:`,ls)
    if (!ls || ls.length<=0) {
      return {error:'not-found', xid:undefined};
    }
    assert(ls[0].startsWith('np14/'))
    // should be 'np14/1595-xyz/'
    const v = ls[0].match(/^np14\/(.*)\/$/);
    console.log(`@115 xid-lookup (${iSeq}) :`,v)
    return {xid:v[1]}
  }
});


Meteor.methods({
  'upload1': async (o={})=>{
    const {opCode, file, dest_fileName, s3fn} = o;
    let {data} = o;
    console.log(`@133 upload1 opCode:<${opCode}> s3fn:<${s3fn}>`)

    if (opCode == 's3.putObject') {

      /*
      console.log(`@137 upload1 data.size:(${data && data.length})`,file,s3fn)
      if (!data || data.length<=0) {
        return {error:'missing-data'}
      }
      */

      const _etime = new Date().getTime();

      if (s3fn.endsWith('.yaml')) {
        /**
        //    CONVERT JSON : ARRAY : YAML
        **/
        const xlsx = JSON.parse(data);
        const mp = yaml.dump(xlsx);
        console.log(mp)
        data = mp;
      }

      if (s3fn.endsWith('.docx')) {
        const data = new Buffer(o.data);
        console.log(`@132 chunk.length:`,data.length)
        const retv1 = await s3.putObject(s3fn, data) // mime type
        console.log(`@17 upload1 <${s3fn}> data.length:${data.length}`,{retv1})
        return {error:null, status:'ok', etime: new Date().getTime() - _etime}
      }

      if (s3fn.endsWith('.pdf')) {
        const data = new Buffer(o.data);
        console.log(`@132 chunk.length:`,data.length)
        const retv1 = await s3.putObject(s3fn, data) // mime type
        console.log(`@17 upload1 <${s3fn}> data.length:${data.length}`,{retv1})
        return {error:null, status:'ok', etime: new Date().getTime() - _etime}
      }

      if (s3fn.endsWith('.jpg')) {
        const data = new Buffer(o.data);
        console.log(`@132 chunk.length:`,data.length)
        const retv1 = await s3.putObject(s3fn, data) // mime type
        console.log(`@17 upload1 <${s3fn}> data.length:${data.length}`,{retv1})
        return {error:null, status:'ok', etime: new Date().getTime() - _etime}
      }

      if (s3fn.endsWith('.md')) {
        // HERE IS TEXT
        const retv1 = await s3.putObject(s3fn, o.data) // mime type
        console.log(`@17 upload1 <${s3fn}> data.length:${o.data.length}`,{retv1})
        return {error:null, status:'ok', etime: new Date().getTime() - _etime}
      }


      const retv1 = await s3.putObject(s3fn, data)
      console.log(`@17 upload1 <${s3fn}> data.length:${data.length}`,{retv1})
      return {error:null, status:'ok', etime: new Date().getTime() - _etime}
    } // s3.putObject




    throw Meteor.error('TODO@23')

    console.log(`@12 upload1 data.size:(${data && data.length})`, {opCode,file,dest_fileName})
    const _etime = new Date().getTime();

    const retv1 = await s3.putObject(dest_fileName, data)
    console.log(`@17 upload1 <${dest_fileName}> data.length:${data.length}`,{retv1})
    return {error:null, status:'ok', etime: new Date().getTime() - _etime}
  }
})

// --------------------------------------------------------------------------

/**
//  this one mk1 catalog is using catIndex : indexp cache
//  it gives
**/

Meteor.methods({
  'mk1-catalog': async (o)=>{
    const {catNo, lang, dry_run=false} = o||{};
    console.log(`@26 mk1-catalog`,o)
    const _etime = new Date().getTime();
//    const cb = new CatalogBuilder({input_s3fn:'blueink/np14'})
    const cb = new CatalogBuilder({input_s3fn:'blueink/np14'})
    cb.indexp = catIndex.indexp; // avoid to load from s3://blueink
    cb.rebuild_catIndex(); // should be in another place.
    console.log(`@226 mk1-catalog`, cb.catIndex[catNo])
    const retv2 = await  cb.mk_catalog({catNo, lang, dry_run})
    console.log(`@297`,{retv2})
    const mtime = new Date();
    catIndex.catlist[catNo].mtime = mtime
    return {catNo, mtime}; // ok
  }
});

// --------------------------------------------------------------------------

Meteor.methods({
  'mk-catalog': async (o)=>{
    const {catNo, lang, dry_run=true} = o||{};
    console.log(`@26 mk-catalog`,o)
    const _etime = new Date().getTime();
    const cb = new CatalogBuilder({input_s3fn:'blueink/np14'})
    await cb.load_cache('s3://blueink/index-np.yaml')
    console.log(`@215:`, cb.indexp)
    await cb.mk_all_catalogs({lang:''})
return {};


    const retv1 = await cb.get_np14_directory()
    console.log(`mk-catalog`,{o},{retv1});
    // {catNo, verbose, lang, dry_run, cache, renew_cache} = o;
    const retv2 = await cb.mk_catalog({catNo,lang,dry_run,verbose:1})
    console.log(`mk-catalog`,{o},{retv2});
    return {error:null, status:'ok', etime: new Date().getTime() - _etime}
  }
})

// -------------------------------------------------------------------------

Meteor.methods({
  'resync-np-page': async (o)=>{
    const {catNo, lang, dry_run=true} = o||{};
    console.log(`@336 resync-np-page`,o)
    const _etime = new Date().getTime();

    // validate_catNo_lang...... TODO

    const cb = new CatalogBuilder({input_s3fn:'blueink/np14'})
    await cb.load_cache('s3://blueink/index-np.yaml')

    /*
        here, cb.catIndex holds list of products to be published for each page.
    */

    console.log(`@344 cb.catIndex['19']`, cb.catIndex['19'].products)

    const {html, iframe_list, log} = await cb.mk_iframe({catNo, lang})

    console.log(`@348`,{iframe_list})
    console.log(`@349`,{log})

    return {error:null,
      log,
      etime: new Date().getTime() - _etime
    };

//    const cb = new CatalogBuilder({input_s3fn:'blueink/np14'})
//    await cb.load_cache('s3://blueink/index-np.yaml')
  }
});

// -------------------------------------------------------------------------

Meteor.methods({
  'ls-cat': async ()=>{
    return catIndex.catlist;
  }
})


Meteor.methods({
  'cat-list': async (o)=>{
    const {xid} = o||{}; // optional - if not specified => list all catalogs
    const catlist = await catIndex.select_catalogs({xid});
    return catlist;
  }
})
