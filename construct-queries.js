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

function constructListWithoutTreatmentQuery (batchSize, graph) {
  const p = path.resolve(__dirname, './queries/4-list-items-without-treatment.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replace('# LIMIT_PLACEHOLDER', batchSize);
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

function constructAttachTreatmentToOtherItemVersionsQuery (graph, agendaItemUris) {
  const p = path.resolve(__dirname, './queries/5-attach-treatment-to-other-versions.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  query = query.replaceAll('# AGENDAITEM_PLACEHOLDER', agendaItemUris.map(sparqlEscapeUri).join('\n    '));
  return query;
}

function constructInsertTriplesQuery (graph, triples) {
  let query = `
  PREFIX pav: <http://purl.org/pav/>
  PREFIX dct: <http://purl.org/dc/terms/>

  INSERT DATA {
    GRAPH # GRAPH_PLACEHOLDER {
  `;
  for (const t of triples) {
    query += `    ${t.s} ${t.p} ${t.o} .\n`;
  }
  query += `
    }
  }
  `;
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

function constructAttachTreatmentsToSubcase (graph) {
  const p = path.resolve(__dirname, './queries/6-attach-treatment-to-subcase.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

function constructAttachExistingNliQuery (graph) {
  const p = path.resolve(__dirname, './queries/7-attach-existing-newsletterinfo-to-behandeling.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

function constructSelectAnnouncementsWithoutNliQuery (graph) {
  const p = path.resolve(__dirname, './queries/8-select-announcements-without-nli.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  // query = query.replaceAll('# LIMIT_PLACEHOLDER', batchSize);
  return query;
}

function constructSelectNliForAnnouncementsQuery (agendaItemUri, graph) {
  const p = path.resolve(__dirname, './queries/9-select-newsletterinfo-for-announcements.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  query = query.replaceAll('# AGENDAITEM_PLACEHOLDER', sparqlEscapeUri(agendaItemUri));
  return query;
}
function constructMigrateStatusCodeQuery (graph) {
  const p = path.resolve(__dirname, './queries/10-decision-resul-code-migration.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

function constructDateMigrationQuery(graph) {
  const p = path.resolve(__dirname, './queries/11-treatements-date-types.sparql');
  let query = fs.readFileSync(p, { encoding: 'utf8' });
  query = query.replaceAll('# GRAPH_PLACEHOLDER', sparqlEscapeUri(graph));
  return query;
}

export {
  constructListDecisionsQuery,
  constructDecisionToTreatmentQuery,
  constructLinkReportNewsletterQuery,
  constructListWithoutTreatmentQuery,
  constructAttachTreatmentToOtherItemVersionsQuery,
  constructInsertTriplesQuery,
  constructAttachTreatmentsToSubcase,
  constructAttachExistingNliQuery,
  constructSelectAnnouncementsWithoutNliQuery,
  constructSelectNliForAnnouncementsQuery,
  constructMigrateStatusCodeQuery,
  constructDateMigrationQuery
};
