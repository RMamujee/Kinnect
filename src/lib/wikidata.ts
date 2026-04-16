/**
 * Wikidata SPARQL — biographical data + kin relations for notable people.
 * No API key required. Endpoint: https://query.wikidata.org/sparql
 */
import type { RecordSearchQuery, RecordSearchResult } from './types';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'Kinnect-Genealogy/1.0 (genealogy research app)';

function sparqlFetch(query: string) {
  return fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
    next: { revalidate: 3600 },
  });
}

export async function searchWikidata(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');
  const yearFilter = birthYear
    ? `FILTER(YEAR(?birth) >= ${birthYear - 5} && YEAR(?birth) <= ${birthYear + 5})`
    : '';

  const sparql = `
    SELECT DISTINCT ?person ?personLabel ?birth ?death ?birthPlaceLabel ?fatherLabel ?motherLabel ?occupationLabel WHERE {
      ?person wdt:P31 wd:Q5;
              rdfs:label ?personLabel.
      FILTER(LANG(?personLabel) = "en")
      FILTER(CONTAINS(LCASE(?personLabel), LCASE("${fullName.replace(/"/g, '')}")))
      OPTIONAL { ?person wdt:P569 ?birth. ${yearFilter} }
      OPTIONAL { ?person wdt:P570 ?death. }
      OPTIONAL { ?person wdt:P19/rdfs:label ?birthPlace. FILTER(LANG(?birthPlace) = "en") }
      OPTIONAL { ?person wdt:P106/rdfs:label ?occupation. FILTER(LANG(?occupation) = "en") }
      OPTIONAL { ?person wdt:P22/rdfs:label ?father. FILTER(LANG(?father) = "en") }
      OPTIONAL { ?person wdt:P25/rdfs:label ?mother. FILTER(LANG(?mother) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 12
  `;

  try {
    const res = await sparqlFetch(sparql);
    if (!res.ok) return [];
    const data = await res.json() as { results: { bindings: Record<string, { value: string }>[] } };

    return data.results.bindings.map(b => {
      const qid = b.person?.value?.split('/').pop() ?? '';
      const label = b.personLabel?.value ?? fullName;
      const bYear = b.birth?.value ? new Date(b.birth.value).getFullYear() : undefined;
      const dYear = b.death?.value ? new Date(b.death.value).getFullYear() : undefined;
      const birthPlace = b.birthPlaceLabel?.value;

      let confidence = 25;
      if (label.toLowerCase() === fullName.toLowerCase()) confidence += 40;
      else if (surname && label.toLowerCase().includes(surname.toLowerCase())) confidence += 20;
      if (givenName && label.toLowerCase().includes(givenName.toLowerCase())) confidence += 10;
      if (birthYear && bYear && Math.abs(bYear - birthYear) <= 2) confidence += 20;
      else if (birthYear && bYear && Math.abs(bYear - birthYear) <= 5) confidence += 10;
      confidence = Math.min(confidence, 90);

      return {
        id: `wikidata-${qid}`,
        source: 'wikipedia' as const,
        externalId: qid,
        name: label,
        birthYear: bYear,
        birthPlace,
        deathYear: dYear,
        fatherName: b.fatherLabel?.value,
        motherName: b.motherLabel?.value,
        recordType: 'other' as const,
        confidence,
        url: `https://www.wikidata.org/wiki/${qid}`,
        snippet: [
          label,
          bYear ? `b. ${bYear}` : '',
          dYear ? `d. ${dYear}` : '',
          birthPlace ? `from ${birthPlace}` : '',
          b.occupationLabel?.value ?? '',
        ].filter(Boolean).join(' · '),
        publicationName: 'Wikidata',
        rawData: b as unknown as Record<string, unknown>,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 30);
  } catch {
    return [];
  }
}

/** Fetch direct family relations for a known Wikidata QID. */
export async function getWikidataKin(
  qid: string,
): Promise<Array<{ relation: string; name: string; qid: string; birthYear?: number; deathYear?: number }>> {
  const sparql = `
    SELECT ?relation ?relative ?relativeLabel ?birth ?death WHERE {
      VALUES (?prop ?relation) {
        (wdt:P22 "father") (wdt:P25 "mother") (wdt:P26 "spouse")
        (wdt:P40 "child") (wdt:P3373 "sibling")
      }
      wd:${qid} ?prop ?relative.
      OPTIONAL { ?relative wdt:P569 ?birth. }
      OPTIONAL { ?relative wdt:P570 ?death. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 30
  `;
  try {
    const res = await sparqlFetch(sparql);
    if (!res.ok) return [];
    const data = await res.json() as { results: { bindings: Record<string, { value: string }>[] } };
    return data.results.bindings.map(b => ({
      relation: b.relation?.value ?? '',
      name: b.relativeLabel?.value ?? '',
      qid: b.relative?.value?.split('/').pop() ?? '',
      birthYear: b.birth?.value ? new Date(b.birth.value).getFullYear() : undefined,
      deathYear: b.death?.value ? new Date(b.death.value).getFullYear() : undefined,
    }));
  } catch {
    return [];
  }
}
