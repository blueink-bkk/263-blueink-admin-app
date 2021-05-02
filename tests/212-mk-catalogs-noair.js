#! /usr/bin/env node

/**
//    mk catalog noair

//    option to rebuild one catalog or default:all (--all)
//    option to rebuild en th default:all.
//    get existing HTML.
//    option to rebuild if HTML not found default:STOP
//    populate with data found in each ya14/product.
//
**/


const assert = require('assert');
const path = require('path')
const yaml = require('js-yaml')
const marked = require('marked');
const renderer = new marked.Renderer(); // std

const s3 = require('./lib/aws-s3.js')(process.env)
const cheerio = require('cheerio')

const CatalogBuilder = require('./lib/mk-catalog-noair.js')

// ----------------------------------------------------------------------

const cmd_line = parse_cmd_line()

const {dry_run, verbose, catNo, all:all_catalogs,
  xid, err_maxCount,
  en_version, th_version,
  output_fn, forceCreateIframe,
  max_row, renew_cache, cache } = cmd_line;


const cb = new CatalogBuilder({
  input_s3fn: `s3://blueink/np14`,
  timeStamp: new Date(),
});


main();

async function main() {

  await cb.get_np14_directory(cmd_line)  // and update indexp

  if (xid) {
    await cb.rebuild_catalogs_for_xid(xid)
    return;
  }

  if (all_catalogs) {
    console.log(`doing all catalogs en:${en_version} th:${th_version}`)

    const cat_keys = Object.keys(cb.catalogs).sort(); // set with cache.....
    console.log(`@58`,{cat_keys})
    for (let catNo_ of cat_keys) {
      console.log(`-- mk-cat ${catNo_} products:${cb.catalogs[catNo_].join(':')}`)
      if (en_version)
        await cb.mk_catalog({catNo:catNo_, verbose, lang:'en', dry_run, max_row, renew_cache})
      if (th_version)
        await cb.mk_catalog({catNo:catNo_, verbose, lang:'th', dry_run, max_row, renew_cache})
    }
    return;
  }

  if (catNo) {
    console.log(`doing 1 cat:${catNo} en:${en_version} th:${th_version}`)
    if (en_version)
      await cb.mk_catalog({catNo:catNo, verbose, lang:'en', dry_run, max_row, renew_cache})
    if (th_version)
      await cb.mk_catalog({catNo:catNo, verbose, lang:'th', dry_run, max_row, renew_cache})
    return;
  }

  console.log(`ALERT@77 we should not be here.`);
}


// ---------------------------------------------------------------------------

function parse_cmd_line() {
  const argv = require('yargs')
    .alias('v','verbose').count('verbose')
    .alias('n','dry-run')
//    .alias('l','lang')
    .alias('c','catNo')
    .alias('a','all')
    .alias('o','output')
    .options({
      'dry-run': {type:'boolean', default:false},
      'renew-cache': {type:'boolean', default:false}, // and use it.
      'cache': {type:'boolean', default:false}, // use cache
      'all': {type:'boolean', default:false},
//      'lang': {default:'all'}, // if lang is specified -> limit to 1
      'en': {type:'boolean', default:false},
      'th': {type:'boolean', default:false},
      'force-create-iframe': {type:'boolean', default:true},
      'err-max': {type:'integer', default:99*999},
      'max-row': {type:'integer', default:99*999},
    }).argv;



  const catNo = argv._[0]
  const {verbose, 'dry-run':dry_run, lang, all,
    output, th, en, forceCreateIframe, xid,
    'err-max':err_maxCount,
    cache, 'renew-cache':renew_cache,
    'max-row':max_row,
  } = argv;


  if (!catNo && !all && !xid) {
    console.log(`MUST HAVE one of: (catNo) or (--all) or (--xid)
      $ ./206-mk-catalogs.js 02
      $ ./206-mk-catalogs.js --all --th
      $ ./206-mk-catalogs.js --xid 1234-Y2K
      `)
  process.exit(1);
  }

  const both = !(en || th)

  if (all && catNo) {
    console.warn(`both --catNo and -all are on the cmd-line. catNo is ignored.`)
  }

  if (xid && (catNo || all)) {
    console.log(`ALERT : cannot specify --xid with --catNo or --all. EXIT.`)
    process.exit(1);
  }

  return Object.assign({
    verbose, dry_run,
    lang, all,
    catNo, xid,
    output_fn:output,
    en_version: en || both,
    th_version: th || both,
    forceCreateIframe,
    cache, renew_cache,
    max_row,
  });

}; // parse cmd-line
