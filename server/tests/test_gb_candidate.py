"""No full simulation matrix: frozen deck, strict input and waveform checks."""
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import numpy as np
import gb_candidate as gb


class TestCandidate(unittest.TestCase):
    def test_four_decks_only_intended_changes(self):
        base = gb.build_deck({})
        for width, cap in [(112, 1), (56, 1), (112, .5), (56, .5)]:
            deck = gb.build_deck({'t9_width_um': width, 'c3_pf': cap})
            restored = deck.replace(f'mT9 ptft_fit W={width:g}u', 'mT9 ptft_fit W=112u').replace(
                f'C3 N2 OUT {cap:g}p', 'C3 N2 OUT 1p')
            self.assertEqual(base, restored)
            self.assertIn('pre_osdi ' + str(gb.OSDI), deck)
            self.assertIn('tran 10n 400u 0 20n', deck)

    def test_invalid_before_directory_creation(self):
        invalid = [None, [], {'t9_width_um': True}, {'c3_pf': '1'},
                   {'t9_width_um': 3}, {'t9_width_um': 513}, {'c3_pf': .049},
                   {'c3_pf': 5.01}, {'c3_pf': float('nan')}, {'c3_pf': float('inf')},
                   {'t9_width_um': 10**1000}, {'temp_C': 25}, {'kind': 'gb_candidate'}]
        with tempfile.TemporaryDirectory() as d, patch.object(gb.backend, 'RUNS', d):
            for desc in invalid:
                self.assertFalse(gb.run_candidate(desc)['ok'], repr(desc))
            self.assertEqual(list(Path(d).iterdir()), [])

    def test_limits(self):
        for w, c in [(4, .05), (512, 5)]:
            self.assertEqual(gb.validate_parameters({'t9_width_um': w, 'c3_pf': c}),
                             {'t9_width_um': w, 'c3_pf': c})

    def wave(self, n=3):
        data = np.zeros((n, len(gb.NAMES) + 1))
        data[:, 0] = np.linspace(0, 400e-6, n)
        return data

    def test_parser_and_invalid_completion(self):
        data = self.wave()
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'out.txt'
            np.savetxt(path, data, header='time ' + ' '.join(f'v({n})' for n in gb.NAMES), comments='')
            np.testing.assert_array_equal(data, gb.parse_wave(path))
        for edit in ['nan', 'duplicate', 'incomplete', 'short', 'wrong_columns']:
            bad = data.copy()
            if edit == 'nan': bad[1, 1] = np.nan
            if edit == 'duplicate': bad[1, 0] = 0
            if edit == 'incomplete': bad[-1, 0] = 300e-6
            if edit == 'short': bad = bad[:1]
            if edit == 'wrong_columns': bad = bad[:, :-1]
            with self.assertRaises(ValueError): gb.validate_wave(bad)

    def test_minmax_preserves_every_signal_extreme(self):
        data = self.wave(10000)
        for j in range(1, data.shape[1]):
            data[j * 17, j] = -j
            data[9000 + j, j] = j
        sampled = gb.downsample(data)
        self.assertLessEqual(len(sampled), 6000)
        np.testing.assert_array_equal(data[:, 1:].min(axis=0), sampled[:, 1:].min(axis=0))
        np.testing.assert_array_equal(data[:, 1:].max(axis=0), sampled[:, 1:].max(axis=0))
        self.assertEqual(sampled[0, 0], 0)
        self.assertEqual(sampled[-1, 0], 400e-6)

    def test_missing_model_keeps_audit_artifacts(self):
        with tempfile.TemporaryDirectory() as d, patch.object(gb.backend, 'RUNS', d), patch.object(gb, 'OSDI', Path(d) / 'absent.osdi'):
            result = gb.run_candidate({})
            self.assertFalse(result['ok'])
            run = Path(d) / result['job']
            for name in ['deck.cir', 'metadata.json', 'ngspice.log']:
                self.assertTrue((run / name).is_file())


if __name__ == '__main__':
    unittest.main()
