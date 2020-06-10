import fs from 'fs';
import path from 'path';
import { sparqlEscapeUri } from 'mu';

String.prototype.replaceAll = function (from, to) {
  return this.split(from).join(to);
}

function constructListDecisionsQuery (batchSize, graph) {
  const p = path.resolve(__dirname, './queries/1-list-decisions.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replace('# LIMIT_PLACEHOLDER', batchSize);
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

function constructDecisionToTreatmentQuery (graph, decisionUris) {
  const p = path.resolve(__dirname, './queries/2-decision-to-treatment.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  query = query.replace('# VALUES_PLACEHOLDER', decisionUris.map(sparqlEscapeUri).join('\n    '));
  return query;
}

function constructLinkReportNewsletterQuery (graph, decisionUris) {
  const p = path.resolve(__dirname, './queries/3-link-report-newsletter.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  query = query.replace('# VALUES_PLACEHOLDER', decisionUris.map(sparqlEscapeUri).join('\n    '));
  return query;
}

export {
  constructListDecisionsQuery,
  constructDecisionToTreatmentQuery,
  constructLinkReportNewsletterQuery
};
