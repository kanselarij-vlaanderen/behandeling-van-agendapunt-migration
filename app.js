import {
  app,
  query,
  update,
  uuid,
  sparqlEscapeString,
  sparqlEscapeUri,
  sparqlEscapeInt,
  sparqlEscapeFloat
} from 'mu';
import * as queries from './construct-queries';
import { parseSparqlResults } from './util';

const GRAPHS = [
  'http://mu.semte.ch/graphs/organizations/kanselarij',
  'http://mu.semte.ch/graphs/organizations/minister',
  'http://mu.semte.ch/graphs/organizations/intern-regering',
  'http://mu.semte.ch/graphs/organizations/intern-overheid',
  'http://mu.semte.ch/graphs/public'
];

const KANSELARIJ_GRAPH = GRAPHS[0];
const SECONDARY_GRAPHS = GRAPHS.slice(1);
const BEHANDELING_BASE_URI = 'http://kanselarij.vo.data.gift/id/behandelingen-van-agendapunt/';
const NLI_BASE_URI = 'http://kanselarij.vo.data.gift/id/nieuwsbrief-infos/';

async function decisionToTreatmentBatch (batchSize, graph) {
  const listDecisionsQuery = queries.constructListDecisionsQuery(batchSize, graph);
  const queryResult = parseSparqlResults(await query(listDecisionsQuery));
  const decisionUris = queryResult.map((r) => r.decision);
  if (decisionUris.length) {
    console.log('Converting decision to treatment ...');
    const decisionToTreatmentQuery = queries.constructDecisionToTreatmentQuery(graph, decisionUris);
    await update(decisionToTreatmentQuery);
    console.log('Linking meeting report and newsletterinfo to treatment ...');
    const linkReportNewsletterQuery = queries.constructLinkReportNewsletterQuery(graph, decisionUris);
    await update(linkReportNewsletterQuery);
  }
  return decisionUris;
}

async function createTreatmentsBatch (batchSize, graph) {
  const listMededelingenQuery = queries.constructListMededelingenQuery(batchSize, graph);
  const queryResult = parseSparqlResults(await query(listMededelingenQuery));
  const mededelingenUris = queryResult.map((r) => r.agendaItem);
  let behandelingTriples = [];
  for (const med of mededelingenUris) {
    const behandelingUuid = uuid();
    const behandelingUri = BEHANDELING_BASE_URI + behandelingUuid;
    behandelingTriples = behandelingTriples.concat([
      { s: sparqlEscapeUri(behandelingUri), p: 'a', o: sparqlEscapeUri('http://data.vlaanderen.be/ns/besluitvorming#BehandelingVanAgendapunt') },
      { s: sparqlEscapeUri(behandelingUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/uuid'), o: sparqlEscapeString(behandelingUuid) },
      { s: sparqlEscapeUri(behandelingUri), p: sparqlEscapeUri('http://data.vlaanderen.be/ns/besluitvorming#heeftOnderwerp'), o: sparqlEscapeUri(med) }
    ]);
  }
  if (behandelingTriples.length) {
    const queryString = queries.constructInsertTriplesQuery(graph, behandelingTriples);
    await update(queryString);
    const attachOtherVersionsQuery = queries.constructAttachTreatmentToOtherItemVersionsQuery(graph, mededelingenUris);
    await update(attachOtherVersionsQuery);
  }
  return mededelingenUris;
}

async function generateNliForAnnouncement (announcement) {
  const nliQueryString = queries.constructSelectNliForAnnouncementsQuery(announcement, KANSELARIJ_GRAPH);
  const announcementInfo = parseSparqlResults(await query(nliQueryString))[0];
  const nliUuid = uuid();
  const nliUri = NLI_BASE_URI + nliUuid;
  const title = announcementInfo.shortTitle || announcementInfo.title;
  const content = announcementInfo.title || '';
  // TODO KAS-1420 : title & content will have same "content" when shortTitle doesn't exist and title does.
  const nliTriples = [
    { s: sparqlEscapeUri(nliUri), p: 'a', o: sparqlEscapeUri('http://data.vlaanderen.be/ns/besluitvorming#NieuwsbriefInfo') },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/uuid'), o: sparqlEscapeString(nliUuid) },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://purl.org/dc/terms/title'), o: sparqlEscapeString(title) },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/htmlInhoud'), o: sparqlEscapeString(content) }
    // TODO KAS-1420 : What about "priority" and "category"(nota/mededeling)? See Valvas-export-service
  ];
  const queryString = queries.constructInsertTriplesQuery(KANSELARIJ_GRAPH, nliTriples);
  await update(queryString);
}

// Begin execution here

const BATCH_SIZE = (process.env.BATCH_SIZE && parseInt(process.env.BATCH_SIZE)) || 200;

(async function () {
  console.log('Convert "beslissing" to BehandelingVanAgendapunt');
  for (const g of GRAPHS) {
    console.log(`Running for graph <${g}>`);
    let i = 1;
    while (true) {
      console.log(`Batch ${i} ...`);
      const treatments = await decisionToTreatmentBatch(BATCH_SIZE, g);
      i++;
      if (treatments.length < BATCH_SIZE) {
        break;
      }
    }
  }

  console.log('Find "mededelingen" without subcase. Create "BehandelingVanAgendapunt" for them as well.');
  let i = 1;
  while (true) {
    console.log(`Batch ${i} ...`);
    const mededelingen = await createTreatmentsBatch(BATCH_SIZE, KANSELARIJ_GRAPH);
    i++;
    if (mededelingen.length < BATCH_SIZE) {
      break;
    }
  }
  // TODO: distribute new "behandelingen" to other graphs

  console.log('Link legacy "nieuwsbriefInfos" of announcements to "behandeling"');
  console.log(`Running for graph <${KANSELARIJ_GRAPH}>`);
  const existingNliQueryString = queries.constructAttachExistingNliQuery(KANSELARIJ_GRAPH);
  await update(existingNliQueryString);

  console.log('Find "mededelingen" without Newsletter-info object, that nonetheless SHOULD appear in the newsletter');
  const queryString = queries.constructSelectAnnouncementsWithoutNliQuery(KANSELARIJ_GRAPH);
  const announcementsWithoutNli = parseSparqlResults(await query(queryString));
  const mededelingenUris = announcementsWithoutNli.map((r) => r.agendaItem);
  for (const announcement of mededelingenUris) {
    console.log(`Running for <${announcement}>`);
    await generateNliForAnnouncement(announcement);
  }
  // TODO: Attach nli to other
  // TODO: distribute new "Newsletterinfo" to other graphs

  console.log('Done running migrations!');
}());
