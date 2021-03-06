/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "_" }] */
/* eslint quote-props: ["error", "always"] */

/**
 * Get the Firestore document or collection at a given path.
 * If the collection contains enough IDs to return a paginated result, this method only returns the first page.
 *
 * @private
 * @param {string} path the path to the document or collection to get
 * @param {string} request the Firestore Request object to manipulate
 * @return {object} the JSON response from the GET request
 */
function get_ (path, request) {
  return getPage_(path, null, request)
}

/**
 * Get a page of results from the given path.
 * If null pageToken is supplied, returns first page.
 *
 * @private
 * @param {string} path the path to the document or collection to get
 * @param {string} pageToken if defined, is utilized for retrieving subsequent pages
 * @param {string} request the Firestore Request object to manipulate
 * @return {object} the JSON response from the GET request
 */
function getPage_ (path, pageToken, request) {
  if (pageToken) {
    request.addParam('pageToken', pageToken)
  }
  return request.get(path)
}

/**
 * Get a list of the JSON responses received for getting documents from a collection.
 * The items returned by this function are formatted as Firestore documents (with types).
 *
 * @private
 * @param {string} path the path to the collection
 * @param {string} request the Firestore Request object to manipulate
 * @return {object} an array of Firestore document objects
 */
function getDocumentResponsesFromCollection_ (path, request) {
  const documents = []
  var pageToken = null

  do {
    var pageResponse = getPage_(path, pageToken, request.clone())
    pageToken = pageResponse.nextPageToken
    if (pageResponse.documents) {
      Array.prototype.push.apply(documents, pageResponse.documents)
    }
  } while (pageToken) // Get all pages of results if there are multiple

  return documents
}

/**
 * Get a list of all IDs of the documents in a collection.
 * Works with nested collections.
 *
 * @private
 * @param {string} path the path to the collection
 * @param {string} request the Firestore Request object to manipulate
 * @return {object} an array of IDs of the documents in the collection
 */
function getDocumentIds_ (path, request) {
  const documents = query_(path, request).select().execute()
  const ids = documents.map(function (doc) {
    const ref = doc.name.match(regexPath_)[1] // Gets the doc name field and extracts the relative path
    return ref.substr(path.length + 1) // Skip over the given path to gain the ID values
  })
  return ids
}

/**
 * Get a document.
 *
 * @private
 * @param {string} path the path to the document
 * @param {string} request the Firestore Request object to manipulate
 * @return {object} an object mapping the document's fields to their values
 */
function getDocument_ (path, request) {
  const doc = get_(path, request)
  if (!doc.fields) {
    throw new Error('No document with `fields` found at path ' + path)
  }
  return unwrapDocumentFields_(doc)
}

/**
 * Get documents with given IDs.
 *
 * @private
 * @see {@link https://firebase.google.com/docs/firestore/reference/rest/v1beta1/projects.databases.documents/batchGet Firestore Documents BatchGet}
 * @param {string} path the path to the document
 * @param {string} request the Firestore Request object to manipulate
 * @param {array} ids String array of document names
 * @return {object} an object mapping the document's fields to their values
 */
function getDocuments_ (path, request, ids) {
  const idPaths = ids.map(function (doc) { return path + '/' + doc }) // Format to absolute paths (relative to API endpoint)
  const documents = request.post(null, { 'documents': idPaths })
  return unwrapBatchDocuments_(documents)
}

/**
 * Set up a Query to receive data from a collection
 *
 * @private
 * @param {string} path the path to the document or collection to query
 * @param {string} request the Firestore Request object to manipulate
 * @return {object} A FirestoreQuery object to set up the query and eventually execute
 */
function query_ (path, request) {
  const grouped = getCollectionFromPath_(path)
  request.route('runQuery')
  const callback = function (query) {
    // Send request to innermost document with given query
    const responseObj = request.post(grouped[0], {
      'structuredQuery': query
    })

    // Filter out results without documents and unwrap document fields
    const documents = responseObj.reduce(function (docs, fireDoc) {
      if (fireDoc.document) {
        docs.push(unwrapDocumentFields_(fireDoc.document))
      }
      return docs
    }, [])

    return documents
  }
  return new FirestoreQuery_(grouped[1], callback)
}
