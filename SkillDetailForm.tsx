import {
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    SelectChangeEvent, // SelectのonChangeイベントの型
} from "@mui/material";
import { useState } from "react";
import { categoryMstData } from "../../../../mocks/data/categoryMst"; // `CategoryMst` のような型があると良い
import { useSkillLevelList } from "../../api/useSkillLevelList";
import {
    deleteSkillResult,
    saveSkillResult,
    updateSkillResult,
} from "../../api/useSkillResult";
import { useSkillResultTree } from "../../api/useSkillResultTree";
import { SkillResultTree } from "../../types"; // SkillResultTree の型定義
import * as React from 'react';
import { BarChart } from '@mui/x-charts';

interface Props {
    empId: string | undefined;
}

// categoryMstData の各要素の型 (仮定)
interface CategoryMst {
    categoryId: number | string;
    name: string;
}

// skillLevels の各要素の型 (仮定)
interface SkillLevelData { // 型名を SkillLevel から変更（Reactコンポーネントと区別のため）
    skillLevelId: number | string;
    label: string;
}

export const SkillDetailForm = ({ empId }: Props) => {
    const [selectedCategory, setSelectedCategory] = useState<string>("");

    const { skillLevels, isSkillLevelsLoading, skillLevelsError } =
        useSkillLevelList();
    const {
        skillResultTree,
        isSkillResultTreeLoading,
        skillResultTreeError,
        mutateSkillResultTree,
    } = useSkillResultTree(empId);

    const handleUpdateSkillResult = async (
        skill: SkillResultTree,
        skillEvaId: number | undefined,
    ) => {
        if (!empId) return; // empIdのチェックは関数の最初で行うと良い

        if (!skillEvaId) {
            if (skill.skillResultId) {
                await deleteSkillResult(skill.skillResultId);
            }
        } else {
            if (skill.skillResultId) {
                await updateSkillResult({
                    empId: Number(empId),
                    skillId: skill.skillId,
                    skillEvaId: skillEvaId,
                });
            } else {
                await saveSkillResult({
                    empId: Number(empId),
                    skillId: skill.skillId,
                    skillEvaId: skillEvaId,
                });
            }
        }
        mutateSkillResultTree();
    };

    if (!empId || Number.isNaN(Number(empId))) {
        return <div>empId is not found or empId is invalid</div>;
    }

    if (skillResultTreeError || skillLevelsError) {
        return <div>エラーが発生しました</div>;
    }

    if (isSkillResultTreeLoading || isSkillLevelsLoading || !skillResultTree || !skillLevels) {
        return <div>Loading...</div>;
    }

    const categoryColorMap: Record<string, string> = {
        "要件定義": "#d32f2f",
        "システム設計": "#1976d2",
        "コーディング": "#388e3c",
        "テスト": "#fbc02d",
        "運用・保守": "#8e24aa",
        "一般": "#f57c00",
    };

    const levelMap: Record<string, number> = {
        "専門": 4,
        "上級": 3,
        "中級": 2,
        "初級": 1,
    };

    const SPACER_LABEL_PREFIX = "___SPACER___";

    let chartXAxisData: string[] = [];
    let chartSeriesData: any[] = [];
    let chartWidth = 600;

    const yAxisConfig = [{
        id: 'levels',
        label: 'レベル',
        valueFormatter: (value: number | null) => { // value can be null for empty bars
            if (value === null) return "";
            const levelLabels: Record<number, string> = { 4: "専門", 3: "上級", 2: "中級", 1: "初級" };
            return levelLabels[value] || (value === 0 ? "" : String(value)) ;
        },
        min: 0,
        max: 4,
        tickValues: [0, 1, 2, 3, 4], // 明示的に目盛りを指定
    }];

    if (selectedCategory === "") {
        const categoryOrderMap = new Map(
            (categoryMstData as CategoryMst[]).map((cat, index) => [String(cat.categoryId), index])
        );

        const sortedSkills = [...skillResultTree].sort((a, b) => {
            const orderA = categoryOrderMap.get(String(a.categoryId)) ?? Infinity;
            const orderB = categoryOrderMap.get(String(b.categoryId)) ?? Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.skillName.localeCompare(b.skillName);
        });

        const seriesDataByCatName: Record<string, (number | null)[]> = {};
        (categoryMstData as CategoryMst[]).forEach(cat => {
            seriesDataByCatName[cat.name] = [];
        });

        let lastCatId: string | null = null;
        let spacerIdx = 0;

        for (const skill of sortedSkills) {
            const currentCatId = String(skill.categoryId);
            const currentCatName = skill.categoryName;

            if (lastCatId !== null && lastCatId !== currentCatId) {
                const spacerLabel = `${SPACER_LABEL_PREFIX}${spacerIdx++}`;
                chartXAxisData.push(spacerLabel);
                (categoryMstData as CategoryMst[]).forEach(cat => {
                    seriesDataByCatName[cat.name].push(null);
                });
            }

            chartXAxisData.push(skill.skillName);
            const levelObj = (skillLevels as SkillLevelData[]).find(l => l.skillLevelId === skill.skillEvaId);
            const numericLevel = levelObj ? levelMap[levelObj.label] : null;

            (categoryMstData as CategoryMst[]).forEach(cat => {
                seriesDataByCatName[cat.name].push(cat.name === currentCatName ? numericLevel : null);
            });
            lastCatId = currentCatId;
        }

        chartSeriesData = (categoryMstData as CategoryMst[])
            .filter(cat => seriesDataByCatName[cat.name]?.some(val => val !== null))
            .map(cat => ({
                data: seriesDataByCatName[cat.name],
                // label: cat.name, // 必要であれば凡例にカテゴリ名を表示
                color: categoryColorMap[cat.name] || '#808080',
                type: 'bar',
            }));
        chartWidth = Math.max(600, chartXAxisData.length * 45); // バー1本あたりの幅を調整

    } else {
        const currentFilteredSkills = skillResultTree.filter(
            (item) => String(item.categoryId) === selectedCategory
        );

        chartXAxisData = currentFilteredSkills.map((item) => item.skillName);
        
        const dataForSeries = currentFilteredSkills.map((item) => {
            const levelObj = (skillLevels as SkillLevelData[]).find(
                (level) => level.skillLevelId === item.skillEvaId
            );
            return levelObj ? levelMap[levelObj.label] : null;
        });

        const selectedCategoryObject = (categoryMstData as CategoryMst[]).find(
            (cat) => String(cat.categoryId) === selectedCategory
        );
        const selectedCategoryColor = selectedCategoryObject
            ? categoryColorMap[selectedCategoryObject.name]
            : '#808080';

        chartSeriesData = [{
            data: dataForSeries,
            // label: selectedCategoryObject?.name || "スキルレベル", // 必要であれば凡例にラベル表示
            color: selectedCategoryColor,
            type: 'bar',
        }];
        chartWidth = Math.max(400, chartXAxisData.length * 70); // バー1本あたりの幅を調整
    }

    const xAxisConfig = [{
        id: 'skills',
        data: chartXAxisData,
        label: 'スキル',
        scaleType: 'band' as const,
        valueFormatter: (value: string) => value.startsWith(SPACER_LABEL_PREFIX) ? '' : value,
    }];

    const tableFilteredSkills =
        selectedCategory === ""
            ? [...skillResultTree].sort((a, b) => { // テーブル表示用にもソートをかけると見やすい
                const categoryOrderMap = new Map(
                    (categoryMstData as CategoryMst[]).map((cat, index) => [String(cat.categoryId), index])
                );
                const orderA = categoryOrderMap.get(String(a.categoryId)) ?? Infinity;
                const orderB = categoryOrderMap.get(String(b.categoryId)) ?? Infinity;
                if (orderA !== orderB) return orderA - orderB;
                return a.skillName.localeCompare(b.skillName);
            })
            : skillResultTree.filter(
                (item) => String(item.categoryId) === selectedCategory
            );

    return (
        <Stack spacing={2}>
            <FormControl sx={{ minWidth: 200 }}>
                <InputLabel id="category-label">カテゴリを選択</InputLabel>
                <Select
                    labelId="category-label"
                    value={selectedCategory}
                    onChange={(e: SelectChangeEvent<string>) => setSelectedCategory(e.target.value)}
                    label="カテゴリを選択"
                >
                    <MenuItem value="">すべてのカテゴリ</MenuItem>
                    {(categoryMstData as CategoryMst[]).map((category) => (
                        <MenuItem
                            key={category.categoryId}
                            value={String(category.categoryId)}
                        >
                            {category.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {chartXAxisData.length > 0 ? (
                <BarChart
                    width={chartWidth}
                    height={300}
                    xAxis={xAxisConfig}
                    yAxis={yAxisConfig}
                    series={chartSeriesData}
                    margin={{ top: 50, bottom: 70, left: 70, right: 30 }} // ラベル表示のためのマージン調整
                    slotProps={{
                        legend: {}, // デフォルトの凡例設定を使用
                    }}
                />
            ) : (
                <Paper sx={{ p: 2, textAlign: 'center' }}>表示するスキルデータがありません。</Paper>
            )}

            <TableContainer component={Paper} sx={{ width: "100%" }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell width="20%">カテゴリ</TableCell>
                            <TableCell width="30%">スキル</TableCell>
                            <TableCell width="30%">詳細</TableCell>
                            <TableCell width="20%">レベル</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tableFilteredSkills.map((skillItem: SkillResultTree, index: number) => (
                            <TableRow key={index}>
                                <TableCell>{skillItem.categoryName}</TableCell>
                                <TableCell>{skillItem.skillName}</TableCell>
                                <TableCell>{skillItem.skillDescription}</TableCell>
                                <TableCell>
                                    {(skillLevels as SkillLevelData[]).find(
                                        (sl: SkillLevelData) => 
                                            sl.skillLevelId === skillItem.skillEvaId
                                    )?.label || "未設定"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Stack>
    );
};