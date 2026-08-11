"""Assert smart MLS header mapping across fixture variants."""
from __future__ import annotations

from pathlib import Path

from export_mapper import inspect_export, load_mapped_export

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"


def _assert_fixture(name: str, *, min_conf: float, expect_status: dict[str, int] | None = None) -> None:
    path = DATA / name
    assert path.exists(), path
    info = inspect_export(path)
    assert info["confidence"] >= min_conf, (name, info["confidence"], info.get("missing_required"))
    assert not info["missing_required"], (name, info["missing_required"])
    df, result = load_mapped_export(path)
    assert len(df) > 0, name
    assert "StatusNorm" in df.columns
    if expect_status:
        got = df["StatusNorm"].value_counts().to_dict()
        for k, v in expect_status.items():
            assert got.get(k) == v, (name, k, got)


def main() -> None:
    _assert_fixture("export-71-criteria.txt", min_conf=1.0)
    _assert_fixture(
        "fixture_reso_sample.csv",
        min_conf=0.9,
        expect_status={"Sold": 1, "Active": 1},
    )
    _assert_fixture(
        "fixture_soft_synonyms.tsv",
        min_conf=0.9,
        expect_status={"Sold": 1, "Pending": 1, "Active": 1},
    )
    _assert_fixture(
        "fixture_near_miss_headers.txt",
        min_conf=0.85,
        expect_status={"Sold": 1, "Pending": 1, "Active": 1},
    )
    # LivingArea must map to FinishedSQFT (not TotalSqFt) on RESO fixture
    reso = inspect_export(DATA / "fixture_reso_sample.csv")
    assert reso["rename_map"].get("LivingArea") == "FinishedSQFT", reso["rename_map"]
    print("mapper fixtures OK")


if __name__ == "__main__":
    main()
