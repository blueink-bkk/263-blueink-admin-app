
const assert = require('assert')
const AWS = require('aws-sdk');
const util = require('util')

function parse_s3filename(fn) {
  const v = fn.match(/s3:\/\/([^\/]+)\/(.+)$/)
  if (v && v.length ==3) {
    return {
      Bucket: v[1], Key: v[2]
    }
  }
  return {Bucket:null, Key:null}
} // parse_s3_filename

let s3client;

module.exports = s3connect;

function s3connect(env={}) {
  let {accessKeyId,
    secretAccessKey,
    endpoint='us-east-1.linodeobjects.com'
  } = env;

  if (!s3client) {
    let {accessKeyId, secretAccessKey} = process.env;
    // console.log({accessKeyId},{secretAccessKey})
    accessKeyId = accessKeyId || Meteor.settings['accessKeyId'];
    secretAccessKey = secretAccessKey || Meteor.settings['secretAccessKey'];

    if (!accessKeyId) throw "Missing S3 accessKeyId"
    if (!secretAccessKey) throw "Missing S3 secretAccessKey"
    // for dkz: July 27, 2020.

    s3client  = new AWS.S3({
              accessKeyId,
              secretAccessKey,
              endpoint,
              s3ForcePathStyle: true, // needed with minio?
              signatureVersion: 'v4',
    });


    /*
    Object.assign(s3client, {
      endpoint,
//      copy_Object,
      put_Object,
      listObjects, //: listObjects.bind({s3client}),
//      update_s3page,
//      wget: wget.bind({endpoint})
//      getObject,
})*/

//    s3client.prototype.wget = wget;
  }
  return {
    s3client,
    endpoint,
    listObjects, ls, ls_objects,
    getObject,
    putObject,
    readdir,
    parse_s3filename,
    listObjectVersions,
    deleteObject,
    deleteObjects,
    deleteObjectVersion, // needs VersionId
    copyObject,
  }
}


async function put_Object(s3client, o) {
  const {Bucket, Key, Body,
    ContentType, ContentEncoding} = o;



  assert(o.Bucket)
  assert(o.Key)
  assert(o.Body)

  let etime = new Date().getTime();

  return new Promise((resolve,reject) =>{
    s3client.putObject(o, function(err, data) {
       if (err) {
         console.log("@46 Got error:", err.message);
         resolve({
           Bucket, Key,
           error:err
         })
         return;

         console.log(`@47 putObject:`, Object.assign(o,{data:null}));
         console.log("Request:");
         console.log(this.request.httpRequest);
         console.log("Response:");
         console.log(this.httpResponse);

         console.log(`@46 `,err, err.stack); // an error occurred
         reject(err)
         return;
       }
       else {
//         console.log(data);           // successful response
         resolve({
           data,
           etime: new Date().getTime() - etime
         })
       }
       /*
       data = {
        CopyObjectResult: {
         ETag: "\"6805f2cfc46c0f04559748bb039d69ae\"",
         LastModified: <Date Representation>
        }
       }
       */
     });
  })
}


async function listObjects(p1) {
  return new Promise((resolve,reject)=>{
    assert(p1.Bucket)
/*
    const p1 = {
      Bucket:'blueink',
      Prefix:'ya11/'
    }*/
    s3client.listObjectsV2(p1, (err,data)=>{
      console.log({err})
      if (err) {
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
}


async function getObject(p1) {
  const etime = new Date().getTime()
  return new Promise((resolve, reject) =>{

    if (typeof p1 == 'string') {
    //  assert(p1.startsWith('s3://'))
    //  p1 = p1.substring(5);
    //console.log(`getObject <${p1}>`)

      if (p1.startsWith('s3://')) p1 = p1.substring(5);

      const v = /([^\/]*)\/(.*)$/.exec(p1)
      if (!v) reject (`Invalid url <${p1}>`);
      p1 = {Bucket:v[1], Key:v[2]}
    }
    if(!p1.Bucket) {
      reject(`Missing Bucket in `,v)
    }
    if(!p1.Key) {
      reject(`Missing Key in `,v)
    }


    const o1 = s3client.getObject(p1, (err,data)=>{
      if (err) {
        // console.log(`@132:`,{err})
        if (err.code == 'NoSuchKey') {
          resolve(null); return;
        }
        reject(err)
        return;
      }
      resolve(Object.assign(data,{
        etime: new Date().getTime()-etime
      }))
    })
  })
}

async function putObject(p1, body) {
  const etime = new Date().getTime()

  return new Promise((resolve, reject) =>{

    if (typeof p1 == 'string') {
      //console.log(`getObject <${p1}>`)
      if (p1.startsWith('s3://')) p1 = p1.substring(5);

      const v = /([^\/]+)\/(.*)$/.exec(p1)
      if (!v) reject (`Invalid url <${p1}>`);


      p1 = {
        Bucket:v[1], Key:v[2],
        // defaults
        ACL: 'public-read',
        ContentType: 'text/html',
        ContentEncoding : 'utf8',
      };

      if (!body) {
        console.log(`ALERT@200 putObject<${p1.Bucket}><${p1.Key}> missing body/data.`)
        reject(`putObject: Missing Body`)
      }


    } // if string


    if(!p1.Bucket) {
      reject(`putObject: Missing Bucket in `,p1)
    }
    if(!p1.Key) {
      reject(`putObject: Missing Key in `,p1)
    }

    if (p1.Body && body) {
      // will never happen.
      console.log(`ALERT@200 putObject<${p1.Bucket}><${p1.Key}> duplicate Body data.`)
    }

    p1.Body = p1.Body || body;


    if(!p1.Body) {
      console.log(`putObject: Missing Body in `,p1)
      reject(`putObject: Missing Body`)
    }


    if (p1.Key.endsWith('.html')) {
      p1.ACL = p1.ACL || 'public-read';
      p1.ContentType = 'text/html';
      p1.ContentEncoding = p1.ContentEncoding || 'utf-8';
    }

    if (p1.Key.endsWith('.txt')) {
      p1.ACL = p1.ACL || 'public-read';
      p1.ContentType = 'text/plain';
      p1.ContentEncoding = p1.ContentEncoding || 'utf-8';
    }

    if (p1.Key.endsWith('.yaml')) {
      p1.ACL = p1.ACL || 'public-read';
      p1.ContentType = 'text/plain';
      p1.ContentEncoding = p1.ContentEncoding || 'utf-8';
    }

    if (p1.Key.endsWith('.jpg')||p1.Key.endsWith('.jpeg')) {
      p1.ACL = p1.ACL || 'public-read';
      p1.ContentType = 'image/jpeg';
      p1.ContentEncoding = null;
    }

    if (p1.Key.endsWith('.pdf')) {
      p1.ACL = p1.ACL || 'public-read';
      p1.ContentType = 'application/pdf';
      p1.ContentEncoding = null;
    }

    if (p1.Key.endsWith('.docx')) {
      p1.ACL = p1.ACL || 'public-read';
      p1.ContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      p1.ContentEncoding = null;
    }



    const o1 = s3client.putObject(p1, (err,data)=>{
      if (err) {
        reject(err)
        return;
      }
      resolve(Object.assign(data,{
        etime: new Date().getTime()-etime,
        Bucket: p1.Bucket,
        Key: p1.Key
      }))
    })
  })
}


async function readdir_chunk(p1) {
  const {Bucket, Key, Delimiter='/'} = p1;
  return new Promise((resolve,reject)=>{
    assert(p1.Bucket)
    s3client.listObjectsV2(p1, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
}

/**

//  the following works to list Common prefixes not Objects
//  like ls
//  to go into subfolders we need recursive flag.
**/

async function ls(p1) {
  const verbose =1;
  if (typeof p1 == 'string') {
    const recursive = false;

    //console.log(`getObject <${p1}>`)
    if (p1.startsWith('s3://')) p1 = p1.substring(5);

//    const v = /([^\/]+)\/(.*)$/.exec(p1)
//    const v = p1.split(/\//)
    const [Bucket, ...rest] = p1.split('/')
    const Prefix = rest.join('/')

    p1 = {
      Bucket, Prefix,
      Delimiter: (recursive)?'':'/',   // we don't want MD, pdf, jpeg we need Prefix.
    };

    ;(verbose >0) && console.log(`@325 s3.ls:`,{p1})
  } // if string

  ;(verbose >0) && console.log(`@328 s3.ls:`,{p1})
  const list = await readdir(p1)
  ;(verbose >0) && console.log(`@330 s3.ls:`,{list})

  return list.map(it => (it.Prefix));
}

/**
//  Content only. No prefixes.
**/

async function ls_objects(p1, o) {
  const verbose =0;

  if (typeof p1 == 'string') {
    const recursive = true;
    if (p1.startsWith('s3://')) p1 = p1.substring(5);
    const [Bucket, ...rest] = p1.split('/')
    const Prefix = rest.join('/')

    p1 = {
      Bucket, Prefix,
      Delimiter: '/', // default : do not recurse.
    };

  } // if string

  Object.assign(p1,o) // o.Delimiter takes over.
  ;(verbose >0) && console.log(`@325 s3.ls:`,{p1})

  const list =[];
  while (true) {
    const data = await ls_chunk(p1)
    list.push(...data.Contents)
    if (!data.IsTruncated) break;
    p1.ContinuationToken = data.NextContinuationToken;
  }


  async function ls_chunk(p1) {
    const {Bucket, Key, Delimiter='/'} = p1;
    return new Promise((resolve,reject)=>{
      assert(p1.Bucket)
      s3client.listObjectsV2(p1, (err,data)=>{
        if (err) {
          console.log({err})
          reject(err)
          return;
        }
  //      console.log(`@112: `, data.getCommonPrefixes())
        resolve(data)
      })
    })
  }

  ;(verbose >0) && console.log(`@380 ls_objects:`,{list})
  return list;
}


async function readdir(p1) {
  const verbose =1;

  const {Bucket, Key, Delimiter='/'} = p1;
  const list =[];
  while (true) {
    ;(verbose >0) && console.log(`@342 s3.readdir:`,{p1})
    const data = await readdir_chunk(p1)
    console.log(`@344`,{data})
    ;(verbose >0) && console.log(`@345`,data.Contents)
    list.push(...data.CommonPrefixes)
    // list.push(...data.Contents)
    ;(verbose >0) && console.log(`@348`,{list})
    if (!data.IsTruncated) break;
    p1.ContinuationToken = data.NextContinuationToken;
  }
  return list;
}


async function listObjectVersions_Obsolete(p1) {
  const {Bucket, Key, Delimiter} = p1;
  const {Prefix=Key} = p1;

  const p2 = {
    Bucket, Prefix, Delimiter
  }

  return new Promise((resolve,reject)=>{
    assert(Bucket)
    assert(Prefix)
    s3client.listObjectVersions(p2, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
} // listObjectVersions


async function deleteObjectVersion_Obsolete(p1) {

  return new Promise((resolve,reject)=>{
    assert(p1.Bucket)
    assert(p1.Key)
    assert(p1.VersionId)
//    assert(p1.BypassGovernanceRetention)

    s3client.deleteObject(p1, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
} // deleteObject


async function deleteObjectVersion(p1) {
  const {Bucket, Key, VersionId} =  p1;
  assert(p1.Bucket)
  assert(p1.Key)
  assert(p1.VersionId)

  return new Promise((resolve,reject)=>{
  const params = {
    Bucket,
    Delete: {
      Objects: [
        {
          Key,
          VersionId,
        },
      ],
   Quiet: false
    }
  };

  s3client.deleteObjects(params, (err,data)=>{
    if (err) {
      console.log({err})
      reject(err)
      return;
    }
//      console.log(`@112: `, data.getCommonPrefixes())
    resolve(data)
  })
})
} // deleteObjectVersion



async function deleteObject(p1) {

  return new Promise((resolve,reject)=>{
    assert(p1.Bucket)
    assert(p1.Key)
    // p1.Version is optional
    s3client.deleteObject(p1, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
} // deleteObject


async function deleteObjects(p1) {

  return new Promise((resolve,reject)=>{
    assert(p1.Bucket)
    assert(p1.Delete)
    s3client.deleteObjects(p1, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
} // deleteObjects

// --------------------------------------------------------------------------

async function copyObject(p1) {

  return new Promise((resolve,reject)=>{
    assert(p1.Bucket)
    assert(p1.Key)
    assert(p1.CopySource)

    s3client.copyObject(p1, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
//      console.log(`@112: `, data.getCommonPrefixes())
      resolve(data)
    })
  })
} // copyObject


// --------------------------------------------------------------------------

async function listObjectVersions(p1, o) {
  const {opCode, verbose=0} = o||{};

  return new Promise((resolve,reject) => {
    if (typeof p1 == 'string') {
      //console.log(`getObject <${p1}>`)
      if (p1.startsWith('s3://')) p1 = p1.substring(5);
      const v = /([^\/]*)\/(.*)$/.exec(p1)
      if (!v) reject (`Invalid url <${p1}>`)
      p1 = {
        Bucket:v[1], Prefix:v[2],
        Delimiter: '/'
      };
    }

    if(!p1.Bucket) {
      reject(`listObjectVersions: Missing Bucket in `,p1)
    }
    if(!p1.Prefix) {
      reject(`listObjectVersions: Missing Prefix in `,p1)
    }

    const {Bucket,Prefix,Delimiter} = p1;
    p1 = {Bucket,Prefix,Delimiter}

    s3client.listObjectVersions(p1, (err,data)=>{
      if (err) {
        console.log({err})
        reject(err)
        return;
      }
      //      console.log(`@112: `, data.getCommonPrefixes())

      const revisions = data.Versions;
      const deleted = data.DeleteMarkers;
      ;(verbose >0) && console.log(`listObjectVersions : revisions count:${revisions.length} deleted:${deleted.length}`)

      const DM_list = [];

      for (const it of revisions) {
        const {Key, VersionId, LastModified, IsLatest, Size} = it;

        //console.log(`-- ${j} Key:${Key} <${VersionId}> ${LastModified} (${Size}) ${IsLatest?'*':''}`)
        if (opCode == 'delete') {
          (verbose>0) && console.log(`${opCode} <${Key}><${VersionId}>`)
          continue;
        }

        if (opCode == 'purge') {
          (verbose>0) && console.log(`${opCode} <${Key}><${VersionId}>`)
          continue;
        }

        if (!IsLatest)
          DM_list.push({Key, VersionId})
      }

      resolve({
        versions:data.Versions, deleteMarkers:data.DeleteMarkers,
        revisions, deleteMarkers:DM_list
      })
    })
  })
} // listObjectVersions
