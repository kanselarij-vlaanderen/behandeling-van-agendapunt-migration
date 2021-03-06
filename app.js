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
  const listItemsQuery = queries.constructListWithoutTreatmentQuery(batchSize, graph);
  const queryResult = parseSparqlResults(await query(listItemsQuery));
  const itemUris = queryResult.map((r) => r.agendaItem);
  let behandelingTriples = [];
  for (const med of itemUris) {
    const behandelingUuid = uuid();
    const behandelingUri = BEHANDELING_BASE_URI + behandelingUuid;
    behandelingTriples = behandelingTriples.concat([
      { s: sparqlEscapeUri(behandelingUri), p: 'a', o: sparqlEscapeUri('http://data.vlaanderen.be/ns/besluit#BehandelingVanAgendapunt') },
      { s: sparqlEscapeUri(behandelingUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/uuid'), o: sparqlEscapeString(behandelingUuid) },
      { s: sparqlEscapeUri(behandelingUri), p: sparqlEscapeUri('http://data.vlaanderen.be/ns/besluitvorming#heeftOnderwerp'), o: sparqlEscapeUri(med) }
    ]);
  }
  if (behandelingTriples.length) {
    const queryString = queries.constructInsertTriplesQuery(graph, behandelingTriples);
    await update(queryString);
    const attachOtherVersionsQuery = queries.constructAttachTreatmentToOtherItemVersionsQuery(graph, itemUris);
    await update(attachOtherVersionsQuery);
  }
  return itemUris;
}

async function generateNliForAnnouncement (announcement, treatment) {
  const nliQueryString = queries.constructSelectNliForAnnouncementsQuery(announcement, KANSELARIJ_GRAPH);
  const announcementInfo = parseSparqlResults(await query(nliQueryString))[0];
  const nliUuid = uuid();
  const nliUri = NLI_BASE_URI + nliUuid;
  const title = announcementInfo.shortTitle || announcementInfo.title;
  const content = announcementInfo.title || '';
  // TODO KAS-1420 : title & content will have same "content" when shortTitle doesn't exist and title does.
  const nliTriples = [
    { s: sparqlEscapeUri(treatment), p: sparqlEscapeUri('http://www.w3.org/ns/prov#generated'), o: sparqlEscapeUri(nliUri) },
    { s: sparqlEscapeUri(nliUri), p: 'a', o: sparqlEscapeUri('http://data.vlaanderen.be/ns/besluitvorming#NieuwsbriefInfo') },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/uuid'), o: sparqlEscapeString(nliUuid) },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://purl.org/dc/terms/title'), o: sparqlEscapeString(title) },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/htmlInhoud'), o: sparqlEscapeString(content) },
    { s: sparqlEscapeUri(nliUri), p: sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/inNieuwsbrief'), o: '"true"^^<http://mu.semte.ch/vocabularies/typed-literals/boolean>' }
    // TODO KAS-1420 : What about "priority" and "category"(nota/mededeling)? See Valvas-export-service
  ];
  const queryString = queries.constructInsertTriplesQuery(KANSELARIJ_GRAPH, nliTriples);
  await update(queryString);
}

// Begin execution here

const BATCH_SIZE = (process.env.BATCH_SIZE && parseInt(process.env.BATCH_SIZE)) || 200;

(async function () {
  console.log('Convert "beslissing" to BehandelingVanAgendapunt');
  let i = 1;
  while (true) {
    console.log(`Batch ${i} ...`);
    const treatments = await decisionToTreatmentBatch(BATCH_SIZE, KANSELARIJ_GRAPH);
    i++;
    if (treatments.length < BATCH_SIZE) {
      break;
    }
  }

  console.log('Find agenda-items without "BehandelingVanAgendapunt". Create "BehandelingVanAgendapunt" for them as well.');
  i = 1;
  while (true) {
    console.log(`Batch ${i} ...`);
    const mededelingen = await createTreatmentsBatch(BATCH_SIZE, KANSELARIJ_GRAPH);
    i++;
    if (mededelingen.length < BATCH_SIZE) {
      break;
    }
  }
  // TODO: distribute new "behandelingen" to other graphs
  console.log('Attaching treatment (/decision) activities to subcase');
  const attachToSubcaseQuery = queries.constructAttachTreatmentsToSubcase(KANSELARIJ_GRAPH);
  await update(attachToSubcaseQuery);

  console.log('Link legacy "nieuwsbriefInfos" of announcements to treatment');
  const existingNliQueryString = queries.constructAttachExistingNliQuery(KANSELARIJ_GRAPH);
  await update(existingNliQueryString);

  console.log('Find "mededelingen" without Newsletter-info object, that nonetheless SHOULD appear in the newsletter');
  const queryString = queries.constructSelectAnnouncementsWithoutNliQuery(KANSELARIJ_GRAPH);
  const announcementsWithoutNli = parseSparqlResults(await query(queryString));
  console.log(`Found ${announcementsWithoutNli.length}`);
  for (const item of announcementsWithoutNli) {
    const { agendaItem, treatment } = item;
    console.log(`Running for <${agendaItem}>`);
    await generateNliForAnnouncement(agendaItem, treatment);
  }

  console.log('Migrate from true/false to result status code.');
  const resultCodeStatusQueryString = queries.constructMigrateStatusCodeQuery(KANSELARIJ_GRAPH);
  await update(resultCodeStatusQueryString);

  console.log('migrate created DATE to DTATIME');
  const datemigrationquerystring = queries.constructDateMigrationQuery(KANSELARIJ_GRAPH);
  await update(datemigrationquerystring);

  // TODO: Attach nli to other
  console.log("Done running migrations! Don't forget to re-run Yggdrasil for fixing data in all graphs");
}());
