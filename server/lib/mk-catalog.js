const assert = require('assert');
const path = require('path')
const yaml = require('js-yaml')
const marked = require('marked');
const renderer = new marked.Renderer(); // std

const writeJsonFile = require('write-json-file');
const loadJsonFile = require('load-json-file');

const s3 = require('264-aws-s3')(process.env)
const cheerio = require('cheerio')


class CatalogBuilder {

  constructor(o) {
    const cb = this;
    const {input_s3fn='blueink/np14', timeStamp=new Date()} = o||{};

    cb.s3_folder = input_s3fn;
    if (cb.s3_folder.startsWith('s3://'))
        cb.s3_folder = cb.s3_folder.substring(5)

    cb.timeStamp = timeStamp;

    this.indexp = {};
//    this.catalogs = {};
//    this.catlist = new Set(); // list of catalogs to rebuild.
//    this.runCount = 0;
//    console.log(`this.indexp:`, cb.indexp)
//    this.catSet = new Set();
    this.catIndex = {}; // product list, en, th
    this.log = [];
    return this;
  }

  todo_add(catNo, lang) {
    this.catIndex[catNo].todo_list = this.catIndex[catNo].todo_list || new Set();
    this.catIndex[catNo].todo_list.add(lang)
  }

} // class CatalogBuilder

CatalogBuilder.prototype.list_indexp = function() {
  const cb = this;
  const keys = Object.keys(cb.indexp)
  for (xid of keys) {
    console.log(`-- indexp[${xid}] `, cb.indexp[xid])
  }
  console.log(`indexp: ${keys.length} rows.`)
}

CatalogBuilder.prototype.list_catalogs = function() {
  const cb = this;
  const keys = Object.keys(cb.catIndex)
  for (catNo of keys) {
    console.log(`-- catalog[${catNo}] `, cb.catIndex[catNo])
  }
  console.log(`found: ${keys.length} catIndex.`)
}

CatalogBuilder.prototype.dump = function() {
  const cb = this;
  console.log('CatalogBuilder.dump');
  console.log(`cb.indexp:`, cb.indexp)
  console.log(`cb.catIndex:`, cb.catIndex)
}

// ----------------------------------------------------------------------------


function s3_parse(s3fn) {
  if (s3fn.startsWith('s3://')) s3fn = s3fn.substring(5);
  const v = /([^\/]*)\/(.*)$/.exec(s3fn)
  if (!v) throw `Invalid s3fn <${s3fn}>`

  const {dir,name,base,ext} = path.parse(v[2]);
  return {
    Bucket: v[1],
    dir, base, name, ext,
    Key: path.join(dir,base),
    Prefix: v[2]
  }
}


;(()=>{
  const {Prefix, Key} = s3_parse('s3://blueink/np14/index.md')
  if (Prefix != 'np14/index.md') {
    console.log({Prefix})
    throw 'fatal@143'
  }
  if (Key != 'np14/index.md') {
    console.log({Key})
    throw 'fatal@144'
  }
})();


// ----------------------------------------------------------------------------
CatalogBuilder.prototype.rebuild_catIndex = function(o) {
  /**
  //  operates on indexp.catlist as Array.
  **/

  const cb = this;

  /**
  // done after cache reloaded
  **/

  try {
    for (xid of Object.keys(cb.indexp)) {
      const {status, catlist} = cb.indexp[xid];
  //    const v = catlist.split(':')
      const v = cb.indexp[xid].catlist; // .split(':')

      v.forEach(catNo => {
        cb.catIndex[catNo] = cb.catIndex[catNo] || {products:[], todo:{en:'',th:''}}
        cb.catIndex[catNo].products.push(xid)}
      );
    }
  } catch (err) {
    console.log({err})
    process.exit(-1)
  }
} // rebuild_catIndex


CatalogBuilder.prototype.rebuild_cat_index = function(o) {
  const cb = this;

  /**
  // done after cache reloaded
  **/

  try {
    for (xid of Object.keys(cb.indexp)) {
      const {status, catlist} = cb.indexp[xid];
  //    const v = catlist.split(':')
      const v = cb.indexp[xid].catlist.split(':')

      v.forEach(catNo => {
        cb.catIndex[catNo] = cb.catIndex[catNo] || {products:[], todo:{en:'',th:''}}
        cb.catIndex[catNo].products.push(xid)}
      );
    }
  } catch (err) {
    console.log({err})
    process.exit(-1)

  }
}


// ---------------------------------------------------------------------------

async function write_cache_indexp(fpath, indexp) {
  if (fpath.endsWith('.yaml')) {
    const data = yaml.dump(indexp)
    if (fpath.startsWith('s3://')) {
      const retv1 = await s3.putObject(fpath,data)
      console.log(`@159`, {retv1})
    } else {
      fs.writeFileSync(fpath,data,'utf8')
    }
  }
  else
  if (fpath.endsWith('.json')) {
    const data = JSON.stringify(indexp)
    if (fpath.startsWith('s3://')) {
      const retv1 = await s3.putObject(fpath,data)
      console.log(`@169`, {retv1})
    } else {
      fs.writeFileSync(fpath,data,'utf8')
    }
  }
  else {
      console.error(`halted@175 Unknow format for output <${fpath}>`);
      process.exit(-1)
  }
} // write_cache_indexp

// ---------------------------------------------------------------------------

async function load_indexp_cache(fpath) {
  if (fpath.startsWith('s3://')) {
    const retv1 = await s3.getObject(fpath)
    if (!retv1 || retv1.error) {
      console.error(`halted@105 file-not-found <${fpath}>`);
      process.exit(-1)
    }

    const data = retv1.Body.toString('utf8')
    if (fpath.endsWith('.json')) {
      return JSON.parse(data)
    }
    else
    if (fpath.endsWith('.yaml')) {
      return yaml.load(data, 'utf8');
    }
    else {
      console.error(`halted@118 Unknow format for input <${fpath}>`);
      process.exit(-1)
    }
  } else {
    const data = fs.readFileSync(fpath,'utf8')
    if (fpath.endsWith('.json')) {
      return JSON.parse(data)
    }
    else
    if (fpath.endsWith('.yaml')) {
      return yaml.load(data, 'utf8');
    }
    else {
      console.error(`halted@118 Unknow format for input <${fpath}>`);
      process.exit(-1)
    }
  } // YAML/JSON
} // load_indexp

// ---------------------------------------------------------------------------
/*
    so far only used in make all catalogs
*/
CatalogBuilder.prototype.load_cache = async function(fpath) {
  const cb = this;
  // cb.runCount =0;
  console.log(`@197`,{fpath})
  assert(fpath)
  const indexp_ = await load_indexp_cache(fpath)
  Object.assign(cb.indexp, indexp_)
  cb.rebuild_cat_index();
}

// ---------------------------------------------------------------------------

/**
//    mk_iframe
//
//    for each product in indexp : TWO MODES :

//      DIRTY CACHE or no CACHE: indexp is just a directory
//        open each MD file
//        update indexp with catlist

//      USING CACHE
//        check if this product goes into current catalog
//        if not : continue next produt

//      add HTML code.
//
//    OPTION TO SAVE TO CACHE and to reuse it.
//    RENEW CACHE
//
**/



// --------------------------------------------------------------------------

/**
//      for each product in indexp:
//
**/

function publish(o) {
  const {xid,meta,data} = o;
  console.log(`publish`,o)
}

CatalogBuilder.prototype.add_product_to_catIndex = function (xid) {
  const cb = this;

  assert(cb.indexp[xid].catlist)
  const catlist = cb.indexp[xid].catlist
  ;(cb.verbose >=0) && console.log(`@303 catlist:`, catlist)

  cb.indexp[xid].catlist.forEach(catNo =>{
    //cb.catSet.add(catNo)
    cb.catIndex[catNo] = cb.catIndex[catNo] || {products:[], todo:{en:'',th:''}};
    cb.catIndex[catNo].products.push(xid)
    cb.catIndex[catNo].todo.en = 'pending'
    cb.catIndex[catNo].todo.th = 'pending'
  })

}

/**
const s = new Set(cb.indexp[xid].catlist)
const v = meta.catlist.split(':')
console.log('318',s)
s.add(...v)
v.forEach(s.add, s);
console.log('319',s)
cb.indexp[xid].catlist = Array.from(s)
console.log(`@237 updated catlist`,cb.indexp[xid])
**/

function validate_catNo(catNo) {
  try{
    if (typeof catNo != 'string') throw `catNo <${catNo}> is not a string`
    if (typeof catNo != String) throw `catNo <${catNo}> is not a string`
    if (!/^\d\d$/.test(catNo)) throw `invalid syntax for catNo <${catNo}>`
  }
  catch(err) {
    console.log({err})
    console.trace();
    process.exit()
  }
}


CatalogBuilder.prototype.mk_iframe = async function(o) {
  const cb = this;
  const {lang, max_row} =o||{};
  let {catNo, verbose} = o; // can be null, and set later.
  const log = [];

  assert(/^\d\d$/.test(catNo), `Invalid format for catNo:<${catNo}>`)

  verbose =2;

  const iframe_list =[];

  for (let xid of Object.keys(cb.indexp)) {
    cb.indexp[xid].status = 'clear'
  }

  if (!catNo) {
    throw `break@303`
  }

  ;(verbose >1) && console.log(`@381 mk_iframe catNo:${catNo}`,o)

  const plist = cb.catIndex[catNo].products;


//  console.log(plist);
//  console.log(cb.catIndex[catNo]);
//  process.exit(-1)

  for (const jj in plist.sort()) {
    const xid = plist[jj]
    const p =cb.indexp[xid];
    // console.log(`--@340 product <${xid}>`,{p})



    if (p.status == 'visited') {
      //;(verbose >1) &&
      throw 'fatal@326'
      console.log(`--@376 product already visited <${xid}> - (*SKIPPED*)`)
      continue;
    }

    if (p.status == 'published') {
      throw 'fatal@332'
      //;(verbose >1) &&
      console.log(`--@382 product already published <${xid}> - (*SKIPPED*)`)
      continue;
    }



    const {meta,data,error} = await cb.open_product({xid,lang});
    if (!meta) {
        ;(verbose >1) && console.log(`open-product ${xid}/${lang} fail error:`,error)
        log.push(error)
        p.status = 'visited'
        ;(verbose >1) && console.log(`--@290 <${xid}> NO metadata - marked visited`)
        continue;
    }

    if (xid != meta.xid) {
      console.log(`fatal@376 xid:${xid} corrupted `,{meta})
      throw 'FATAL@377'
    }

    try {
      const html = cb.mk1_html(meta,data,lang);
      iframe_list.push ({xid,html})
    } catch(err) {
      console.error(err)
      throw 'fatal@346'
    }
    p.status = 'published'
    cb.log.push(`@449 mk-iframe:${catNo} <${xid}/${lang}>} published`)

    ;(verbose >0) && console.log(`--@345 ${+jj+1}/${plist.length} product merged in catNo:${catNo}/${lang} <${xid}> `)

  } // loop on products


  //;(verbose>1) &&
  console.log(`@380 mk_iframe(catNo:${catNo}, lang:"${lang}") => iframe_list:[${iframe_list.length}]`)


  const html = iframe_list.map(({xid,html}) =>{
    return `

      <div class="col-lg-4 col-md-6">
      <article id="${xid}" class="js-e3article e3object card new-card" e3object="s3://blueink/np14/${xid}/index-${lang}.md">
      ${html}
      </article>
      </div>

      `
    }).join('\n')

//  const html = catalog.map((it)=>(it.html)).join('\n\n')

  ;(verbose >0) && console.log(`@398 mk_iframe <${catNo}/${lang}> iframe_list:[${iframe_list.length}]`)
  const retv = {html, iframe_list, catNo, log};
  console.log(`@410`,{iframe_list},{log})
  return retv;
} // mk_iframe


CatalogBuilder.prototype.open_product = async function(o) {
  const verbose =1;
  const cb = this;
  const {xid,lang} = o||{};
  assert(lang,'@489 Missing lang.')

  const s3fn = `s3://blueink/np14/${xid}/index-${lang}.md`
  ;(verbose >0) && console.log(`@422 open_product(${s3fn}) o:`,o)
  const retv1 = await s3.getObject(s3fn)
  if (!retv1 || retv1.error) {
    console.log(`ALERT@354 file-not-found <${xid}><${s3fn}>`,{retv1})
    return {error: `file-not-found <${s3fn}>`};
  }
//      console.log(`@221`,retv1.Body.toString('utf8'))
  const retv2 = metadata_from(retv1.Body.toString('utf8'))
  if (!retv2) {
    return {error: `ALERT@355 <${s3fn}>`};
  }
  const {meta, data} = retv2;

//  cb.indexp[xid].catlist = cb.indexp[xid].catlist || [];
  // do we need a flag to tell this product removed ?
  // cb.indexp[xid].status = 'removed'

  // catlist is a string in metadata....

  /*
  if (meta.catlist) {
    const s = new Set(cb.indexp[xid].catlist)
    s.add(...meta.catlist.split(':'))
    meta.catlist = cb.indexp[xid].catlist = Array.from(s)
    //console.log(`@237`,cb.indexp[xid])
  } else {
    // console.log(`ALERT@199 <${xid}> has no catalogs`,{retv1})
    console.log(`ALERT@199 <${xid}/${lang}> has no catalogs`,{meta})
    //console.log(`ALERT@199 <${xid}> has no catalogs`,{data})
//    console.log(`exit@236`); process.exit(-1)
    cb.indexp[xid].catlist = []; // empty
  }
  */

  return {meta, data};
} // open_product


// --------------------------------------------------------------------------

// get_iframe({catNo,lang,verbose})

CatalogBuilder.prototype.get_iframe =  async function(o) {
  const cb = this;
  const {catNo, lang, verbose} =o||{};

  const s3fn = 's3://' + path.join(cb.s3_folder, `iframe-test${catNo}${lang}.html`);
  const retv1 = await s3.getObject(s3fn)


  if (!retv1) {
//    console.log(`file-not-found : create file - checking indexp.keys:`,Object.keys(indexp))
    console.log(`@337 get_iframe <${s3fn}> file-not-found`)
    return {error:'file-not-found', s3fn}
  }

  ;(verbose>0) && console.log(`@341 get_iframe <${s3fn}>:`,{retv1})

//  console.log({html:retv1.Body.toString('utf8'), index:[]})
  return {html:retv1.Body.toString('utf8'), s3fn}
}


CatalogBuilder.prototype.repopulate_iframe =  async function(html, lang='en') {
  const cb = this;
  const verbose = 0;
  const $ = cheerio.load(html)
  const articles = [];

  $('.js-e3article').each(function() {
    ;(verbose>1) && console.log(`@297 --- ID:'${this.attribs.id}'`)
    articles.push(this)
    // $(this).html('*EMPTY*');
  });

  console.log(`repopulate_iframe html.length:${html.length} found: ${articles.length} articles.`)

  // for each article : get from server and re-insert

  for (div of articles) {
    const xid = div.attribs.id;

    /**
    //  xid contains (lang) !!!!!!!!!!!!!!!!!!!!!!
    **/

    const v = /(.*)\((.*)\)$/.exec(xid);
    if (!v) {
      console.log(`ALERT@460 article xid:${xid} Invalid Syntax.`)
      continue;
    }


    const [,xid_,lang] = v;
    const s3fn = 's3://' + path.join(cb.s3_folder, `${xid_}/index.md`);
//    ;(verbose >=0) && console.log(`@314 -- merging article ${xid}/${lang} =><${s3fn}>`)
    const retv = await s3.getObject(s3fn)
    if (!retv || retv.error) {
      console.log(`ALERT@270 article xid:${xid_} <${s3fn}> not-found in s3://blueink`,{retv})
      continue;
    }

    ;(verbose >=0) && console.log(`@440 -- merged article ${xid_}/${lang}`)
    const {html:html1} = cb.mk1_html(retv.Body.toString('utf8'),lang);
    /*
    ;(verbose >0) && console.log(`---- <xid> --------------------------------
      ${html1}
      -----------------------------------------------------------------------
      `)*/

    $(div).html(html1)
  }

  ;(verbose >0) && console.log(`done with ${articles.length} merged products.`)

  const row = $.html();

  return {html:row, index:[]}
}

// ----------------------------------------------------------------------------

/**
//      mk_catalog
//
//      mk_iframe to create list then html for this cat.
//      visit each product metadata to check if belongs to this catalog
//      update indexp to speed up next mk_iframe
//      update catlist
//

//      if catNo undefined and set later :
**/


CatalogBuilder.prototype.mk_catalog =  async function(o) {
  const cb = this;
  const {catNo, lang, xid, verbose, dry_run, cache, renew_cache} = o;
  assert(lang, '@627 Missing-lang')
//  ;(verbose >1) && console.log(`@499 mk_catalog(${catNo})`,o)
  //;(cb.verbose >=0) &&
  console.log(`@499 mk_catalog(${catNo}/${lang})`)
  assert(/^\d\d$/.test(catNo), `Invalid format for catNo:<${catNo}>`)

  // not async !
//  let {html, catalog} = await cb.mk_iframe({catNo, lang, create:true, dry_run, verbose, cache, renew_cache})
  let {html, iframe_list, catNo:catNo_} = await cb.mk_iframe(o)

  const s3fn = 's3://'+ path.join('blueink', `${lang}/new-products-${catNo_}.html`);
//  const s3fn2 = 's3://'+ path.join('blueink', `${lang}/new-products3-${catNo_}.html`);


  /**
  // html contains catalog page content injected.
  **/

  // console.log(`334`,{catalog})

  if (verbose >2) {
    console.log(`mk_catalog(${catNo}, lang:"${lang}")`)
//    for (it of catalog) {
//      console.log(`---cat:${catNo}--- `,it)
//    }
    console.log(`---cat:${catNo}---  total:${iframe_list.length}`)
  }


  /**
  //    ALERT AND EXIT IF NO PRODUCTS IN CATALOGS
  **/

  if (html.length <=0) {
    console.log(`alert@449 mk_iframe(catNo:${catNo}, lang:${lang}) => null`, {iframe_list})

    if (iframe_list.length <=0) {
      const outfn = 's3://'+ path.join(cb.s3_folder, `iframe-test${catNo}${lang}.html`);
      const retv4 = await s3.putObject(outfn, '<html><!-- EMPTY --></html>')
      console.log(`@661`,{retv4})
      ;(verbose >0) && console.log(`ALERT@717 done : mk_catalog(${catNo}) lang:${lang} is EMPTY.`)

      cb.catIndex[catNo_].todo[lang] = 'failed'
      return;
    }


    console.log(`fatal@395 mk_iframe(catNo:${catNo}, lang:${lang}) => null`, {iframe_list})
    return;
  }
  /**
  //    scan HTML with Cheerio
  //    ALREADY DONE
  **/

//  console.log({html}); process.exit(-1)



//   let {html:html2} = await cb.repopulate_iframe(html,lang);


  /**
  //    Get template : new products for this lang
  //    inject html2 into row.
  //    populate_row also fill all e3objects !!!!!!!!!
  **/

  const html2 = await populate_row({html, lang, timeStamp:cb.timeStamp})
//  console.log({html2}); process.exit(-1)


  if (dry_run) {
//    console.log(`-------------------------------------------------------------
//${html2}
//------------------------------------------------------------------------`)


    console.log(`@609 exit mk_catalog(${catNo_}/${lang}) <${s3fn}> new html-length:${html2.length}
    DRY-RUN : NOT WRITTEN EXIT.`)
  } else {
    const retv4 = await s3.putObject(s3fn, html2)
    //console.log(`@702`,{retv4})
    //;(verbose >0) &&
    console.log(`@615 exit mk_catalog <${catNo_}/${lang}> written on <${retv4.Key}>
    VersionID: ${retv4.VersionId}
    `)


    try {
      cb.catIndex[catNo_].todo = cb.catIndex[catNo_].todo || {};
      cb.catIndex[catNo_].todo[lang] = 'published'
    }
    catch(err) {
      console.log({err})
      console.log(cb.catIndex)
      process.exit(-1)
    }

  }

  return;
} // mk_catalog

// --------------------------------------------------------------------------

/**
//    fill also all e3objects
**/

async function populate_row(o) {
  const {html:row_html,lang,timeStamp} = o;
  const s3fn = `s3://blueink/${lang}/new-products.html`
  //console.log(`@463:`,{s3fn})
  const retv1 = await s3.getObject(s3fn); // template
  //console.log(`@463:`,retv1)

  let html = retv1.Body.toString('utf8');
  const $ = cheerio.load(html);
  const row = $('div#main-content');
  row.html(`\n
    <!-- DO NOT EDIT MANUALLY INSIDE THIS DIV
         CONTENT IS AUTOMATICALLY UPDATED BY 259.217-mk-calatalog
    -->
    ` + row_html
  )

  $('div#e3object-time-stamp').html(o.timeStamp)

  html = $.html()
  return html
}


// --------------------------------------------------------------------------

CatalogBuilder.prototype.apply_template_product_blueink = function(meta, data, lang) {
  const verbose =0;
  const cb = this;
  const {xid, sku, img, pdf} = meta;
  const {type=sku} = meta;
//  const {type = xid} = meta;
  const iSeq = parseInt(xid); //xid.replace(/\-.*$/,'');
  assert(iSeq);
  const productId = xid; // iSeq +'-'+ type; // wring and anyway what we need is folder
  ;(verbose >0) && console.log(`@701 iSeq:${iSeq} productId:${productId}`,{meta})

  const html = marked(data, { renderer: renderer });

  const download = (lang=='en')?'Download PDF':'ดาวน์โหลด PDF';
// could be a template.

  let status = '';

  if (meta.status && (meta.status.toLowerCase() != 'active')) {
    //console.log(`@479 status:`,meta.status)
    status = `
    <div style="color:magenta; text-align:center">
    ${meta.status.replace(/\n/gi,'<br>')}
    </div>
    `;
  }

  const {Prefix} = s3_parse(cb.s3_folder);

  const article_innerHtml = `
  <!-- Prefix:"${Prefix}" -->
  <img src="/np14/${productId}/${img}" class="card-imgs mb-2">
  ${status}
  <small class="text-grey mb-2"><b>Type: ${type}</b> </small>
  ${html}
  <div class="btns">
  <a href="/np14/${productId}/${pdf}" target="_blank" class="btn-red">
  ${download}
  </a>
  <span class="number-btn">${iSeq}</span>
  </div>
`

  if (false && status) {
    console.log(`STATUS:${status}
      --------------------------------------------------------------------
      ${article_innerHtml}
      --------------------------------------------------------------------
      `)
  }


  return article_innerHtml;
}

// --------------------------------------------------------------------------

CatalogBuilder.prototype.mk_catalogs_for_xid = async function (o) {
  const cb = this;
  const {xid, lang} = o||{}
  console.log(`mk_catalogs_for_xid(${xid}/${lang})`);
  // list the catalogs with ref to this xid.

//  console.log(`@942:`,cb.indexp[xid].catlist);process.exit(-1)

  for (catNo of cb.indexp[xid].catlist.split(':')) {
    assert(/^\d\d$/.test(catNo), `Invalid format for catNo:<${catNo}>`)

    if (!lang || lang=='en') await cb.mk_catalog({catNo,lang:'en'})
    if (!lang || lang=='th') await cb.mk_catalog({catNo,lang:'th'})
  }

  console.log(`@948 done with rebuild_catalogs_for_xid(${xid}/${lang})`)
return;
  await cb.mk_catalog({lang:lang||'en',xid}); // catNo undefined will activate a special hook.

  /**
  //    here catSet is updated
  //    we might rebuild a list of catalogs
  **/

  // console.log(`@804 catSet:${Array.from(cb.catSet).join(':')}`)
  //const todo_list = Array.from(cb.catSet)

  let todo_list = Object.keys(cb.catIndex).map(catNo =>{
    return {catNo, todo: cb.catIndex[catNo].todo}
  });

//  const catNo1 = todo_list.splice(0,1);

//  console.log(`@823 todo-list:`,todo_list.join(':'))

  for (const it of todo_list) {
    for (const lang of Object.keys(it.todo)) {
//      console.log(`--@869 todo <${it.catNo}/${lang}> todo:"${it.todo[lang]}"`)
      if (it.todo[lang] == 'pending') {
        await cb.mk_catalog({catNo:it.catNo, lang})
      }
    }

/*
    if (it.todo.en.pending) {
      await cb.mk_catalog({catNo:it.catNo, lang:'en'})
    }
    if (it.todo.th.pending) {
      await cb.mk_catalog({catNo:it.catNo,lang:'th'})
    }
*/
  }

//  console.log(`exit@805`); process.exit(-1)

  console.log(`@835 done with rebuild_catalogs_for_xid(${xid})`)
}

// --------------------------------------------------------------------------

CatalogBuilder.prototype.patch_iframe = async function (o) {
  const cb = this;
  const {catNo, xid, lang='en', verbose=0} = o;
  console.log(`patch_iframe(catNo:${catNo}/${lang}, xid:${xid})`);

  /**
  // fetch MD
  // fetch <iframe>
  **/

  const md_s3fn = 's3://' + path.join(cb.s3_folder,xid,'index.md')
  const retv1 = await s3.getObject(md_s3fn)
  const data = retv1.Body.toString('utf8');
  // console.log({retv1})

//  const {metadata, data:md} = metadata_from(retv1.Body.toString('utf8'))
  const {html:html1, metadata} = cb.mk1_html(data, lang);
  //console.log(`@505 `,{html1})

  /**
  // phase2 :
  //      get iframe : this could be done earlier...
  //      locate e3object in iframe
  //      injecter html1 into iframe
  **/

  /**
  //  get parent filename according to metadata
  //  or lookup for parent html.
  **/

  const {format='blueink'} = metadata;

  if (format == 'blueink') {
    /**
    //    MD file is related to HTML in parent directory
    //    ./home/index.md  => ./home.html
    //    ./np14/xyz/index.md => ./np14/xyz.html this does not make sense in this case.
    **/
  }

  const {html,error,s3fn} = await cb.get_iframe({catNo,lang,verbose})
  if (error) {
    console.log(`@565 get_iframe(catNo:${catNo}, lang:${lang})
    Unable to get iframe source: <${s3fn}>
    Patch iframe failed - run again with catNo option
    Suggested:
    $ ./206-mk-catalogs.js ${catNo} -v --force-create --${lang}
    `);
    return {html:null, error:'fatal@576'}
  }


  const $ = cheerio.load(html);
  const retv = locate_e3object($,xid)
  if (retv.error) {
    console.log(`fatal@587 locate_e3object(${xid}) =>`,{retv2})
    return retv;
  }


  console.log(`html.length1:${html.length}`)
  console.log({retv})
  console.log(`@585:`, $(retv))
  $(retv).html(html1)
  console.log(`html.length2:${$.html().length}`)

  console.log(`@574 - done with patch_iframe <${s3fn}> (catNo:${catNo}, lang:${lang})`)
//console.log({html})


/**
// SAVE THE IFRAME
**/

const outfn = 's3://'+ path.join(cb.s3_folder, `iframe-test${catNo}${lang}.html`);
const retv4 = await s3.putObject(outfn, $.html())
console.log(`@917`,{retv4})
;(verbose >0) && console.log(`done : patch_iframe(${catNo}) lang:${lang}.`)

  return {html:$.html(), s3fn}
} // patch_iframe


function locate_e3object($$, e3objectId) {
  const articles = [];

  /**
  //  Get Metadata : e3object
  **/
  const className = 'js-e3article';

  /**
  //  Locate e3object
  **/

//  const selector = `#${id} .${className}`
  const selector = `#${e3objectId}`

  $$(selector).each(function(x) {
    console.log(`--- (${selector}) ID:<${this.attribs.id}>`)
//    console.log(`--- ID:'${this.attribs.id}'`)
    articles.push(this)
//    $$(this).html('*EMPTY*');

/*****************
    $$(this).html(html1);
    if (metadata.class) {
      $$(this).addClass(metadata.class)
    }
*******************/
  });


  /**
  // ALTERNATE TENTATIVE
  **/

  if (articles.length <=0) {
    const selector = '#' + e3objectId.replace(/\-.*$/,'');
    console.log(`second tentative with selector:<${selector}>`);

    $$(selector).each(function(x) {
      console.log(`---retry-- (${selector}) ID:<${this.attribs.id}>`)
  //    console.log(`--- ID:'${this.attribs.id}'`)
      articles.push(this)
  //    $$(this).html('*EMPTY*');

      /*******************
      $$(this).html(html1);
      if (metadata.class) {
        $$(this).addClass(metadata.class)
      }
      *******************/
    });
  }

  if (articles.length != 1) {
    console.log(`ALERT@125 (${articles.length})`,{selector})
//    throw 'ALERT@125'
    return {
      articles: articles.map(a=>a.attribs.id),
//      html: $$.html(),
      error: 'e3object-not-found'
    }
  }

  return articles[0];
}


function metadata_from(data) {
//  console.log({data})
  const v = data.trim().split(/\-\-\-/g); //match(yamlBlockPattern);
  assert(!v[0])
  assert(v.length == 3)
//  console.log(v)
  const meta = yaml.load(v[1], 'utf8');
//  console.log({meta})
  return {meta, data:v[2]}
}



CatalogBuilder.prototype.mk1_html = function (meta, data, lang) {
  const cb = this;

  if (meta.format == 'html') {
    // PURE HTML - NO NEED RENDERER
    return md;
  }

//    const inner_html = marked((lang=='th')?th:en, { renderer: renderer });
  const inner_html = cb.apply_template_product_blueink(meta, data, lang)
  //console.log({inner_html})
//    $(articles[j]).html(inner_html)
  return (inner_html)
}


// --------------------------------------------------------------------------

CatalogBuilder.prototype.mk_all_catalogs = async function(o) {
  const cb = this;
  const {lang} = o||{};

  for (catNo of Object.keys(cb.catIndex).sort()) {
    assert(/^\d\d$/.test(catNo), `Invalid format for catNo:<${catNo}>`)

    if (!lang || lang=='en') await cb.mk_catalog({catNo,lang:'en'})
    if (!lang || lang=='th') await cb.mk_catalog({catNo,lang:'th'})
  }

  console.log(`@948 done with rebuild_all_catalogs`)

} // mk-all-catalogs

// --------------------------------------------------------------------------


/**
//      how to know LANG ?
//      s3://blueink/en/new-products-19.html
//      each e3object should know its lang ...
//          to apply the correct renderer/template
//
**/


CatalogBuilder.prototype.rebuild_web_page = async function (p1, p2) {
  const cb = this;
  if (typeof p1 == 'string') {
    const _p1 = p1;
    if (p1.startsWith('s3://')) p1 = p1.substring(5);
    const v = /([^\/]*)\/(.*)$/.exec(p1)
    if (!v) reject (`Invalid url <${_p1}>`)
    p1 = {
      Bucket:v[1], Key:v[2],
    };
  }

  if(!p1.Bucket) {
    return({error: `Undefined Bucket`})
  }

  if(!p1.Key) {
    return({error: `Undefined Key`})
  }

  Object.assign(p2,p1)

  const {verbose=false, dry_run,
    e3selector = '.e3object',
    output = `s3://${p1.Bucket}/${p1.Key}`, // same
  } = p2;

  const retv1 = await s3.getObject(p1);
  //console.log({retv1})

  let html = retv1.Body.toString('utf8');
  const $ = cheerio.load(html)

  if (true) {
  // update revision timeStamp in html metadata
    const mt = $('meta[name="e3object"]');
    //console.log({mt})
  }

/*
$('.js-e3article').each(function() {
  console.log(`--- ID:'${this.attribs.id}'`)
  e3objects.push(this)
});
*/

// for each article : get from server and re-insert

  const e3objects_ = $(e3selector);
  const e3objects = [];
  e3objects_.each((j,it)=>{
    const s3fn = it.attribs.e3object;
  // console.log(`--${j} inject <${s3fn}> `)
    e3objects.push(it);
  })

  console.log(`found ${e3objects.length} e3objects`)

  for (it of e3objects) {
    let s3fn = it.attribs.e3object;
    //console.log(`-- e3object <${s3fn}> `)
    /**
    //    check for absolute path ex: s3://blueink
    //    relative path:  /en/blueinkaddress
    //    relative path:  blueinkaddress
    **/

    if (!s3fn.startsWith('s3://')) {
      if (s3fn.startsWith('/')) {
        s3fn = path.join(p1.Bucket,s3fn); // absolute in same bucket
      } else {
        const {dir} = path.parse(p1.Key)
        s3fn = path.join(p1.Bucket,dir,s3fn);
      }
    }


    const retv1 = await s3.getObject(s3fn);
    if (!retv1 || retv1.error) {
      console.log(`ALERT@445 <${s3fn}> object-not-found`,retv1)
      continue;
    }

    /**
    //      MD files must be rendered
    **/

    let data_ = retv1.Body.toString('utf8');

    if (s3fn.endsWith('.md')) {
      const lang = (s3fn.endsWith('-en.md'))?'en':'th';
      const {meta,data} = metadata_from(data_)
      ;(verbose >1) && console.log(`@1227`,{meta})
      const html = cb.mk1_html(meta, data, lang);
      $(it).html(html);
      ;(verbose >=0) && console.log(`-- injected <${s3fn}> (${retv1.Body.toString('utf8').length})`)
    }
    else {
      $(it).html(data_)
      ;(verbose >=0) && console.log(`-- injected <${s3fn}> (${retv1.Body.toString('utf8').length})`)
    }
  } // loop on e3objects

  console.log(`html before : ${html.length}`)
  html = $.html()
  console.log(`html after : ${html.length}`)

  if (dry_run) {
    console.log(`DRY-RUN target <${output}> not updated.`,p1)
  } else {
//    Object.assign(p1, {Body:html})
    const retv2 = await s3.putObject(output, html)
    console.log({retv2})
  }

  return {
    e3objects: e3objects.map(a=>a.attribs.e3object),
    html: $.html()
  }

}



// --------------------------------------------------------------------------


module.exports = {
  CatalogBuilder,
  load_indexp_cache,
  write_cache_indexp
};
