const assert = require('assert');
const path = require('path')
const yaml = require('js-yaml')
const marked = require('marked');
const renderer = new marked.Renderer(); // std

const writeJsonFile = require('write-json-file');
const loadJsonFile = require('load-json-file');

const s3 = require('264-aws-s3')(process.env)
const cheerio = require('cheerio')


class CatalogBuilder2 {

  constructor(o) {
    const cb = this;
    const {input_s3fn='blueink/np14', timeStamp=new Date()} = o||{};

    cb.s3_folder = input_s3fn;
    if (cb.s3_folder.startsWith('s3://'))
        cb.s3_folder = cb.s3_folder.substring(5)

    cb.timeStamp = timeStamp;

    this.indexp = {};
    this.catalogs = {};
    this.catlist = new Set(); // list of catalogs to rebuild.
    this.dirty_cache = true;
//    console.log(`this.indexp:`, cb.indexp)
    return this;
  }

} // class CatalogBuilder

CatalogBuilder2.prototype.list_indexp = function() {
  const cb = this;
  const keys = Object.keys(cb.indexp)
  for (xid of keys) {
    console.log(`-- indexp[${xid}] `, cb.indexp[xid])
  }
  console.log(`indexp: ${keys.length} rows.`)
}

CatalogBuilder2.prototype.list_catalogs = function() {
  const cb = this;
  const keys = Object.keys(cb.catalogs)
  for (catNo of keys) {
    console.log(`-- catalog[${catNo}] `, cb.catalogs[catNo])
  }
  console.log(`found: ${keys.length} catalogs.`)
}

CatalogBuilder2.prototype.dump = function() {
  const cb = this;
  console.log('CatalogBuilder.dump');
  console.log(`cb.indexp:`, cb.indexp)
  console.log(`cb.catalogs:`, cb.catalogs)
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
CatalogBuilder2.prototype.rebuild_cat_index = function(o) {
  const cb = this;

    for (xid of Object.keys(cb.indexp)) {
      const {status, catlist} = cb.indexp[xid];
  //    const v = catlist.split(':')
      const v = [...new Set(catlist)];

      v.forEach(catNo => {
        cb.catalogs[catNo] = cb.catalogs[catNo] || []
        cb.catalogs[catNo].push(xid)}
      );
    }
}

// ---------------------------------------------------------------------------

CatalogBuilder2.prototype.get_np14_directory = async function(o) {
  const {verbose=0, max_row, cache, renew_cache} = o||{}
  const cb = this;

  if (cache && !renew_cache) {
    /**
    // repopulate indexp from indexp.json
    // DONT DO THIS IF RENEW CASH
    **/

    const json = loadJsonFile.sync('./indexp.json');
//    console.log(`@108`,{json})
    if (json && Object.keys(json).length >0) {
      cb.dirty_cache = false;
      cb.indexp = json;
      cb.rebuild_cat_index();
      return;
    } else {
      console.log(`loading cache failed dirty:=true`)
      cb.dirty_cache = true;
    }
  }


  const {Bucket,Prefix} = s3_parse(cb.s3_folder)

  ;(verbose >1) && console.log(`@137 get_np14_directory Bucket:${Bucket} Prefix:${Prefix}`);

  const list = await s3.readdir({
      Bucket: 'blueink',
      Prefix: 'np14/',
//      Bucket,
//      Prefix,
      Delimiter: '/'
    });

  ;(verbose >0) && console.log(`@147 get_np14_directory@101 list.length:${list.length}`)
  ;(verbose >0) && console.log(`@148 Bucket:${Bucket} Prefix:${Prefix}`)


  /**
  //  we have a directory.
  //  filter to get only products folder
  **/

  //console.log({list})
  for (it of list) {
          //console.log(`@107:`,it)
    const xid = it.Prefix.replace('np14/','').replace('/','')
  //        const iSeq = sku.replace(/\-.*$/,'')
    const v = xid.match(/^(\d\d\d\d)-/)
    if (!v) continue;

    const [,iSeq] = v;
    if (!cb.indexp[xid]) {
      //;(verbose >1) && console.warn(`new from s3: <${xid}>`)
      cb.indexp[xid] = {xid, catlist:[]}; // cat info not available in np14
    } else {
      if (cb.indexp[xid].xid && cb.indexp[xid].xid != xid) {
        throw 'fatal@117'
      }

      cb.indexp[xid].xid = xid;
  //          console.log(`@121: <${iSeq}><${sku}>`,cb.indexp[iSeq])
    }
  }; // for

  if (verbose>5) {
    Object.keys(cb.indexp).forEach((xid) =>{
//      console.log(`-- product <${xid}> sku:<${cb.indexp[xid].xid}>  listed in cat:`,cb.indexp[xid].catlist;
      console.log(`-- product <${xid}> sku:<${cb.indexp[xid].xid}>  listed in cat:`,cb.indexp[xid].catlist.join(':'))
      console.log(`-- product <${xid}> sku:<${cb.indexp[xid].xid}>`)
    })
  }

  ;(verbose >0) && console.log(`done : get_np14_directory ${Object.keys(cb.indexp).length} products`)
  /**
  //   no need to return : result is in indexp.
  **/
} // get_np14_directory

// --------------------------------------------------------------------------

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


CatalogBuilder2.prototype.add_product_dirty_mode = async function (catNo, xid, lang) {
  const retv1 = await s3.getObject(`s3://blueink/np14/${xid}/index-${lang}.md`)
  if (!retv1 || retv1.error) {
    console.log(`ALERT@218 <${xid}>`,{retv1})
    return;
  }
//      console.log(`@221`,retv1.Body.toString('utf8'))
  const {meta, data} = metadata_from(retv1.Body.toString('utf8'))
  cb.indexp[xid].catlist = cb.indexp[xid].catlist || [];
  // do we need a flag to tell this product removed ?
  // cb.indexp[xid].status = 'removed'

  if (meta.catlist) {
    const s = new Set(cb.indexp[xid].catlist)
    s.add(...meta.catlist.split(':'))
    cb.indexp[xid].catlist = Array.from(s)
    console.log(`@237`,cb.indexp[xid])
  } else {
    console.log(`ALERT@199 <${xid}> has no catalogs`,{retv1})
    console.log(`ALERT@199 <${xid}> has no catalogs`,{meta})
    console.log(`ALERT@199 <${xid}> has no catalogs`,{data})
    console.log(`exit@236`); process.exit(-1)
    return;
  }

  if (!cb.indexp[xid].catlist.includes(catNo)) {
    return; // but now indexp is updated.
  }

  // add to current catalog ONLY IF catNo match.
  ;(verbose >=0) && console.log(`@315 -- merged article ${xid}/${lang}`)
  const html = cb.mk1_html(meta,data,lang);
//console.log(`ALERT@246 todo lang....`)
  catalog.push({xid,html})

  //      console.log(`@190`, {meta},{data})
}

CatalogBuilder2.prototype.add_product = async function (catalog, catNo, xid, lang) {
  const cb = this;
  const verbose =0;
  const s3fn = `s3://blueink/np14/${xid}/index-${lang}.md`;
  const retv1 = await s3.getObject(s3fn);

  if (!retv1 || retv1.error) {
    console.log(`ALERT@260 <${s3fn}> `,{retv1})
    console.log(`ALERT@260 <${xid}/${lang}> product-not-found or REMOVED <${s3fn}>`, cb.indexp[xid])
    return;
  }

  const {meta, data} = metadata_from(retv1.Body.toString('utf8'))
  console.log(`@315 -- merging product for cat:${catNo}/${lang} ${xid}`,meta.catlist)

  assert(meta.catlist.includes(catNo));

  const html = cb.mk1_html(meta,data,lang);
  catalog.push({xid,html})
}


CatalogBuilder2.prototype.mk_iframe = async function(o) {

  const cb = this;
  const {catNo='00', lang, create, force_create, verbose, renew_cache, max_row, dry_run} =o||{};

  ;(verbose >0) && console.log(`>> mk_iframe catNo:${catNo} dirty_cache:${cb.dirty_cache}`,o)

  const lost_products = []; // list of xid lost products
//  const lang_ = `(${lang})`
  const catalog =[];

  let jCount =0;

  for (let xid of Object.keys(cb.indexp).sort()) {
    const p =cb.indexp[xid];
//    console.log(`@183 <${xid}>`,p.catlist)
    if (jCount >max_row) break;
    jCount ++;
    //console.log(`@194`,{p})
    if (cb.dirty_cache) {
      //console.log(`@195`,{p})
      const s3fn = `s3://blueink/np14/${xid}/index-${lang}.md`
      const retv1 = await s3.getObject(s3fn)
      if (!retv1 || retv1.error) {
        console.log(`ALERT@299 <${xid}/${lang}> product-not-found <${s3fn}>`,{retv1})
        console.log(`ALERT@299 <${xid}/${lang}> product-not-found or REMOVED <${s3fn}>`, cb.indexp[xid])
//        console.log(`EXIT@298`); process.exit(-1)
        continue;
      }
//      console.log(`@199`,retv1.Body.toString('utf8'))
      const {meta, data} = metadata_from(retv1.Body.toString('utf8'))
      cb.indexp[xid].catlist = cb.indexp[xid].catlist || [];
      // do we need a flag to tell this product removed ?
      // cb.indexp[xid].status = 'removed'

      ;(verbose >0) && console.log(`@308 (dirty-cache) indexp[${xid}]:`,cb.indexp[xid])

      if (meta.catlist) {
        console.log(`@236 updating catlist <${xid}> meta:`,meta);
        console.log(`@236 updating catlist`,cb.indexp[xid])
        const s = new Set(cb.indexp[xid].catlist)
        const v = meta.catlist.split(':')
        console.log('318',s)
        s.add(...v)
        v.forEach(s.add, s);
        console.log('319',s)
        cb.indexp[xid].catlist = Array.from(s)
        console.log(`@237 updated catlist`,cb.indexp[xid])
      } else {
        ;(verbose>2) && console.log(`ALERT@313 <${xid}> has no catalogs`,{retv1})
        ;(verbose>0) && console.log(`ALERT@313 <${xid}> has no catalogs`,{meta})
        ;(verbose>1) && console.log(`ALERT@313 <${xid}> has no catalogs`,{data})
        ;(verbose>=0) && console.log(`ALERT@313 <${xid}> @<${s3fn}> has no catalogs`,cb.indexp[xid])
//        console.log(`EXIT@319`); process.exit(-1)
        continue;
      }

      // add to html
      if (cb.indexp[xid].catlist.includes(catNo)) {
        ;(verbose >=0) && console.log(`@315 -- cat:${catNo} merging article ${xid}/${lang}`)
        const html = cb.mk1_html(meta,data,lang);
        catalog.push({xid,html})
      } else {
        ;(verbose >=0) && console.log(`@329 -- cat:${catNo} article ${xid}/${lang} catlist:${cb.indexp[xid].catlist.join(':')} ignored`)
      }
      //      console.log(`@190`, {meta},{data})
    } // dirty_cache
    else {
      if (!p.catlist.includes(''+catNo)) {
        ;(verbose >0) && console.log(`@340 -- product <${xid}> not in cat:${catNo} -ignored`,p)
        ;(verbose >0) && console.log(`@340 -- product <${xid}> dirty-cache:false`, p)
        continue;
      }

      await cb.add_product(catalog,catNo,xid,lang);
    }

    console.log(`@201 <${xid}> catlist:${cb.indexp[xid].catlist.join(':')}`,cb.indexp[xid])

  } // loop

  console.log(`@357 about to write cache renew_cache:${renew_cache} dry_run:${dry_run}`)

  if (renew_cache) {
    if (!dry_run) {
      //console.log(`@225 renew_cache`,cb.indexp)
      writeJsonFile.sync(path.join('', 'indexp.json'), cb.indexp)
      console.log(`--------------------------------------------------------`)
      console.log(cb.indexp)
      console.log(`--------------------------------------------------------`)
      console.log(`@226 done writing cache <indexp.json>`)
    } else {
      console.log(`@278 DRY-RUN renew-cache request ignored`)
    }
  }


  cb.dirty_cache = false; // sauf si errors !!!!

  //console.log(`@225`,{catalog});


  ;(verbose>0) && console.log(`mk_iframe(catNo:${catNo}, lang:"${lang}") => catalog:[${catalog.length}]`)


  const html = catalog.map(({xid,html}) =>{
    return `

      <div class="col-lg-4 col-md-6">
      <article id="${xid}" class="js-e3article card new-card">
      ${html}
      </article>
      </div>

      `
    }).join('\n')




//  const html = catalog.map((it)=>(it.html)).join('\n\n')

  ;(verbose >0) && console.log(`mk_iframe catNo:${catNo} dirty:${cb.dirty_cache} catalog:${catalog.length}`)
  return {html, catalog};
} // mk_iframe


// --------------------------------------------------------------------------

// get_iframe({catNo,lang,verbose})

CatalogBuilder2.prototype.get_iframe =  async function(o) {
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


CatalogBuilder2.prototype.repopulate_iframe =  async function(html, lang='en') {
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
**/


CatalogBuilder2.prototype.mk_catalog =  async function(o) {
  const cb = this;
  const {catNo, verbose, lang, dry_run, cache, renew_cache} = o;

  ;(verbose >0) && console.log(`@499 mk_catalog(${catNo})`,o)

  // not async !
//  let {html, catalog} = await cb.mk_iframe({catNo, lang, create:true, dry_run, verbose, cache, renew_cache})
  let {html, catalog} = await cb.mk_iframe(o)

  /**
  // html contains catalog page content injected.
  **/

  // console.log(`334`,{catalog})

  if (verbose >2) {
    console.log(`mk_catalog(${catNo}, lang:"${lang}")`)
    for (it of catalog) {
      console.log(`---cat:${catNo}--- `,it)
    }
    console.log(`---cat:${catNo}---  total:${catalog.length}`)
  }


  /**
  //    ALERT AND EXIT IF NO PRODUCTS IN CATALOGS
  **/

  if (html.length <=0) {
    console.log(`alert@449 mk_iframe(catNo:${catNo}, lang:${lang}) => null`, {catalog})

    if (catalog.length <=0) {
      const outfn = 's3://'+ path.join(cb.s3_folder, `iframe-test${catNo}${lang}.html`);
      const retv4 = await s3.putObject(outfn, '<html><!-- EMPTY --></html>')
      console.log({retv4})
      ;(verbose >0) && console.log(`done : mk_catalog(${catNo}) lang:${lang}. EMPTY.`)
      return;
    }


    console.log(`fatal@395 mk_iframe(catNo:${catNo}, lang:${lang}) => null`, {catalog})
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
    console.log(`-------------------------------------------------------------
${html2}
------------------------------------------------------------------------`)
    console.log(`@571 mk_catalog(${catNo}, lang:"${lang}") new html-length:${html2.length}
    DRY-RUN : NOT WRITTEN EXIT.`)
    return;
  }


  const outfn = 's3://'+ path.join('blueink', `${lang}/new-products-${catNo}.html`);
  const retv4 = await s3.putObject(outfn, html2)
  console.log({retv4})
  ;(verbose >0) && console.log(`done : mk_catalog(${catNo}) lang:${lang} <${outfn}>`)
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
  row.html(row_html)

  $('div#e3object-time-stamp').html(o.timeStamp)

  /*
  const e3objects = $('.e3object');
  const vo = [];
  e3objects.each((j,it)=>{
    const s3fn = it.attribs.e3object;
    // console.log(`--${j} inject <${s3fn}> `)
    vo.push(it);
  })

  for (it of vo) {
    const s3fn = it.attribs.e3object;
    console.log(`-- inject <${s3fn}> `)
    const retv1 = await s3.getObject(s3fn);
    if (!retv1 || retv1.error) {
      console.log(`ALERT@445 `,retv1)
      continue;
    }
    $(it).html(retv1.Body.toString('utf8'))
  }
  */

  html = $.html()
  return html
}


// --------------------------------------------------------------------------

CatalogBuilder2.prototype.apply_template_blueink = function(meta, data, lang) {
  const cb = this;
  const {xid, sku:type, img, pdf} = meta;
  const iSeq = xid.replace(/\-.*$/,'');
  assert(iSeq);
  const productId = iSeq +'-'+ type;

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

CatalogBuilder2.prototype.rebuild_catalogs_for_xid = async function (xid) {
  const cb = this;
  console.log(`rebuild_first_catalog_for_xid(${xid})`);
  // list the catalogs with ref to this xid.

  const retv1 = s3.getObject(`s3://blueink/np14/${xid}/index-en.md`)
  const {meta,data} = metadata_from(retv1.Body.toString('utf8'))
  console.log({meta})
  console.log(`exit@686`);process.exit(-1)

  /**
  //    get metadata for each product : populate indexp/catlist
  **/


  for (catNo of cb.indexp[xid].catlist) {
    const {html,error} = await cb.patch_iframe({catNo, xid});
  }

  console.log(`done with rebuild_catalogs_for_xid(${xid})`)
}

// --------------------------------------------------------------------------

CatalogBuilder2.prototype.patch_iframe = async function (o) {
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
console.log({retv4})
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



CatalogBuilder2.prototype.mk1_html = function (meta, data, lang) {
  const cb = this;

  if (meta.format == 'html') {
    // PURE HTML - NO NEED RENDERER
    return md;
  }

//    const inner_html = marked((lang=='th')?th:en, { renderer: renderer });
  const inner_html = cb.apply_template_blueink(meta, data, lang)
  //console.log({inner_html})
//    $(articles[j]).html(inner_html)
  return (inner_html)
}


// --------------------------------------------------------------------------




// --------------------------------------------------------------------------


module.exports = CatalogBuilder2;
