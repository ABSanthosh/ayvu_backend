# Test Suite for Ayvu Backend

This directory contains comprehensive tests for the Ayvu backend codebase.

## Test Structure

The test suite is organized to mirror the source code structure:

- `test_utils.ts` - Common utilities and mocks for testing
- `utils_test.ts` - Tests for utility functions (nanoid)
- `progress_test.ts` - Tests for progress tracking system
- `embedding_chunker_test.ts` - Tests for HTML chunking functionality
- `embedding_worker_test.ts` - Tests for embedding worker (limited due to ML models)
- `embedding_index_test.ts` - Tests for embedding index functionality
- `postprocessing_test.ts` - Tests for HTML postprocessing modules
- `postprocessing_utils_test.ts` - Tests for postprocessing utilities
- `process_arxiv_test.ts` - Tests for ArXiv download and extraction
- `process_latex_test.ts` - Tests for LaTeX compilation (limited due to LaTeXML dependency)
- `process_drive_test.ts` - Tests for Google Drive integration (limited due to API)
- `main_test.ts` - Tests for main application structure

## Running Tests

### Run All Tests
```bash
deno task test
```

### Run Tests with Watch Mode
```bash
deno task test:watch
```

### Run Tests with Coverage
```bash
deno task test:coverage
```

### Run Specific Test File
```bash
deno test --allow-all tests/utils_test.ts
```

## Test Limitations

Some tests are limited due to external dependencies:

1. **ML Models**: Embedding tests don't actually load models, they test structure and error handling
2. **LaTeXML**: LaTeX compilation tests verify logic but don't test actual compilation without LaTeXML installed
3. **Google Drive API**: Drive tests verify structure but don't test actual uploads without valid credentials
4. **Network Requests**: ArXiv download tests verify logic but don't test actual downloads

## Test Coverage

The test suite covers:

✅ **Utility Functions**: Complete coverage of nanoid generation and validation
✅ **Progress System**: Complete coverage of progress tracking and user sessions
✅ **HTML Chunking**: Complete coverage of document parsing and chunking logic
✅ **Postprocessing**: Complete coverage of HTML transformations
✅ **File Processing**: Logic testing for file discovery and handling
✅ **Error Handling**: Comprehensive error condition testing
✅ **Type Safety**: TypeScript type validation
✅ **Edge Cases**: Boundary conditions and invalid input handling

## Writing New Tests

When adding new functionality, please add corresponding tests:

1. Create a new test file following the naming pattern `*_test.ts`
2. Import test utilities from `test_utils.ts`
3. Use descriptive test names and organize with `t.step()`
4. Clean up any temporary files/directories in test cleanup
5. Handle expected failures gracefully for external dependencies

## Mock Strategy

The test suite uses mocking for:

- Progress workers (simplified interface)
- DOM manipulation (using JSDOM)
- File system operations (temporary directories)
- Network requests (expecting failures)
- External tools (LaTeXML, APIs)

This ensures tests are fast, reliable, and don't require external services.