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

async function runBatch (batchSize, graph) {
  const listDecisionsQuery = queries.constructListDecisionsQuery(batchSize, graph);
  const queryResult = parseSparqlResults(await query(listDecisionsQuery));
  const decisionUris = queryResult.map((r) => r.decision);
  const decisionToTreatmentQuery = queries.constructDecisionToTreatmentQuery(graph, decisionUris);
  await update(decisionToTreatmentQuery);
  const linkReportNewsletterQuery = queries.constructLinkReportNewsletterQuery(graph, decisionUris);
  await update(linkReportNewsletterQuery);
  return decisionUris;
}

// Begin execution here

const BATCH_SIZE = (process.env.BATCH_SIZE && parseInt(process.env.BATCH_SIZE)) || 5;

(async function () {
  for (const g of GRAPHS) {
    console.log(`Running for graph <${g}>`);
    const i = 1;
    while (true) {
      console.log(`Batch ${i} ...`);
      const treatments = await runBatch(BATCH_SIZE, g);
      if (treatments.length < BATCH_SIZE) {
        break;
      }
    }
  }
  console.log('Done running migrations!');
}());
