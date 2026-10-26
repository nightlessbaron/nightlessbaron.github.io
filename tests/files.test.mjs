import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/browser.mjs';

const has = p => fs.existsSync(path.join(ROOT, p));

test('Jekyll machinery is gone and .nojekyll is present', () => {
  assert.ok(has('.nojekyll'));
  for (const p of ['_config.yml', '_pages', 'talkmap', '_includes', 'Gemfile', 'markdown_generator', 'files/paper1.pdf'])
    assert.ok(!has(p), `${p} should be removed`);
});

test('real files are kept and the new CV is added', () => {
  const keep = ['files/VARAD_CV_ML.pdf',
    ...['CAPS', 'DIP_IEEE', 'EEG', 'META_4x', 'SMM4H', 'WNUT'].map(n => `files/publications/${n}.pdf`),
    'files/thesis/Geolocation_Extraction_for_Twitter_Final.pdf', 'files/Multiwinner_Voting_with_Admissible_Sets.pdf',
    'files/Lecture_Series_on_Fair_Division.pdf', 'files/Lecture_Series_on_Computational_Social_Choice.pdf',
    'files/teaching/ACMW_Summer_School_AGT_2019.pdf', 'files/code/DIP_Repro.m',
    'images/varad.jpg', 'images/Places/nagpur.jpg', 'images/ACM_School/grp_pic.jpg'];
  for (const p of keep) assert.ok(has(p), `${p} should exist`);
});
