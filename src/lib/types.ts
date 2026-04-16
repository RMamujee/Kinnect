// ─── Core Genealogy Types ────────────────────────────────────────────────────
// Compatible with GEDCOM 5.5.1 structure and Genealogical Proof Standard (GPS)

export type Gender = 'male' | 'female' | 'unknown';
export type RelationshipType = 'biological' | 'adopted' | 'step' | 'foster' | 'unknown';
export type SourceQuality = 1 | 2 | 3 | 4; // 1=primary original, 2=primary derivative, 3=secondary original, 4=secondary derivative

// ─── GPS Evidence Types ──────────────────────────────────────────────────────

export type EvidenceType = 'original' | 'derivative' | 'authored';
export type InformationType = 'primary' | 'secondary' | 'undetermined';
export type RecordType =
  | 'birth_certificate'
  | 'death_certificate'
  | 'marriage_certificate'
  | 'census'
  | 'immigration'
  | 'naturalization'
  | 'military'
  | 'obituary'
  | 'will_probate'
  | 'land_deed'
  | 'church_record'
  | 'newspaper'
  | 'photograph'
  | 'family_bible'
  | 'oral_history'
  | 'dna'
  | 'other';

export type ConfidenceLevel = 'proven' | 'probable' | 'possible' | 'unverified' | 'conflicting';

// ─── Source & Citation ────────────────────────────────────────────────────────

export interface Source {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  publicationDate?: string;
  repository?: string;
  repositoryUrl?: string;
  callNumber?: string;
  recordType: RecordType;
  evidenceType: EvidenceType;
  informationType: InformationType;
  quality: SourceQuality;
  url?: string;
  imageUrl?: string;
  transcription?: string;
  notes?: string;
  accessDate?: string;
  // GPS fields
  analysis?: string;         // analyst's evaluation of the source
  conflicts?: string[];      // IDs of conflicting sources
  resolutionNotes?: string;  // how conflicts were resolved
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  id: string;
  sourceId: string;
  personId: string;
  factId: string;
  page?: string;
  detail?: string;  // specific item within the source
  transcription?: string;
  confidence: ConfidenceLevel;
  notes?: string;
  createdAt: string;
}

// ─── Person Fact ─────────────────────────────────────────────────────────────

export type FactType =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'divorce'
  | 'baptism'
  | 'burial'
  | 'immigration'
  | 'emigration'
  | 'naturalization'
  | 'military_service'
  | 'occupation'
  | 'residence'
  | 'education'
  | 'religion'
  | 'name_change'
  | 'alias'
  | 'note';

export interface GeoLocation {
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  coordinates?: { lat: number; lng: number };
  fullText?: string;
}

export interface Fact {
  id: string;
  personId: string;
  type: FactType;
  value?: string;
  date?: PartialDate;
  place?: GeoLocation;
  confidence: ConfidenceLevel;
  citationIds: string[];
  notes?: string;
  isPreferred: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Partial Date (handles "circa 1850", "between 1848-1852", "before 1900") ─

export interface PartialDate {
  year?: number;
  month?: number;
  day?: number;
  qualifier?: 'about' | 'before' | 'after' | 'between' | 'calculated' | 'estimated';
  year2?: number; // for "between" ranges
  displayText?: string;
}

// ─── Person ──────────────────────────────────────────────────────────────────

export interface PersonName {
  id: string;
  personId: string;
  given: string;
  surname: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
  maidenName?: string;
  type: 'birth' | 'married' | 'aka' | 'stage' | 'religious';
  isPreferred: boolean;
  citationIds: string[];
}

export interface Person {
  id: string;
  names: PersonName[];
  gender: Gender;
  facts: Fact[];
  // Cached preferred fact values for quick access
  birthYear?: number;
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  isLiving?: boolean;
  // External IDs
  familySearchId?: string;
  wikiTreeId?: string;
  ancestryId?: string;
  gedcomId?: string;
  // GPS
  gpsStatus: GPSStatus;
  // Media
  profileImageUrl?: string;
  // Meta
  addedByUser: boolean;
  autoPopulated: boolean;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Family Unit ──────────────────────────────────────────────────────────────

export interface Family {
  id: string;
  spouse1Id?: string;
  spouse2Id?: string;
  childIds: string[];
  marriageFact?: Fact;
  divorceFact?: Fact;
  relationshipType: RelationshipType;
  citationIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── GPS Status ───────────────────────────────────────────────────────────────
// Tracks compliance with the 5 elements of the Genealogical Proof Standard

export interface GPSStatus {
  // 1. Reasonably exhaustive search
  searchCompleted: boolean;
  sourcesSearched: string[]; // source names/repositories checked
  // 2. Complete and accurate citations
  allFactsCited: boolean;
  citationCount: number;
  // 3. Analysis and correlation of sources
  sourcesAnalyzed: boolean;
  conflictsIdentified: number;
  // 4. Resolution of conflicting evidence
  conflictsResolved: boolean;
  unresolvedConflicts: number;
  // 5. Soundly reasoned conclusion
  conclusionWritten: boolean;
  conclusionText?: string;
  // Overall
  overallConfidence: ConfidenceLevel;
  lastReviewedAt?: string;
}

// ─── Search & Records ─────────────────────────────────────────────────────────

export type RecordSource =
  | 'familysearch'
  | 'wikitree'
  | 'findagrave'
  | 'newspaper'     // Chronicling America (LOC)
  | 'wikipedia'     // Wikipedia articles
  | 'archive'       // Internet Archive
  | 'news'          // Google News / RSS
  | 'other';

export interface RecordSearchQuery {
  givenName?: string;
  surname?: string;
  birthYear?: number;
  birthYearRange?: number; // ±N years
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  occupation?: string;
  recordTypes?: RecordType[];
  sources?: RecordSource[];
}

export interface RecordSearchResult {
  id: string;
  source: RecordSource;
  externalId: string;
  name: string;
  birthYear?: number;
  birthPlace?: string;
  deathYear?: number;
  deathPlace?: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  recordType: RecordType;
  confidence: number; // 0-100 match score
  url?: string;
  snippet?: string;   // excerpt / article text preview
  publicationDate?: string; // for newspaper/news results
  publicationName?: string; // newspaper title
  rawData?: Record<string, unknown>;
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  personId: string;
  text: string;
  authorName?: string;
  parentId?: string; // for threaded replies
  createdAt: string;
  updatedAt: string;
}

// ─── Tree Layout ──────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  personId: string;
  generation: number;  // 0 = root, positive = ancestors, negative = descendants
  position: { x: number; y: number };
}

export interface TreeEdge {
  id: string;
  source: string;  // node id
  target: string;  // node id
  relationship: 'parent' | 'child' | 'spouse';
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface GenealogyState {
  persons: Record<string, Person>;
  families: Record<string, Family>;
  sources: Record<string, Source>;
  citations: Record<string, Citation>;
  comments: Record<string, Comment>;
  rootPersonId: string | null;
  selectedPersonId: string | null;
  onboardingComplete: boolean;
  autoSearchCompleted: boolean;
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export interface OnboardingPersonInput {
  given: string;
  surname: string;
  maidenName?: string;
  gender: Gender;
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  birthCity?: string;
  birthState?: string;
  birthCountry?: string;
  deathYear?: number;
  deathCity?: string;
  deathState?: string;
  isLiving?: boolean;
}

export interface OnboardingData {
  self: OnboardingPersonInput;
  father?: OnboardingPersonInput;
  mother?: OnboardingPersonInput;
  maternalGrandfather?: OnboardingPersonInput;
  maternalGrandmother?: OnboardingPersonInput;
  paternalGrandfather?: OnboardingPersonInput;
  paternalGrandmother?: OnboardingPersonInput;
  spouse?: OnboardingPersonInput;
  siblings: OnboardingPersonInput[];
  children: OnboardingPersonInput[];
}
