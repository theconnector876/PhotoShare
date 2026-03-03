import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, GripVertical } from "lucide-react";
import type { BookingTerms, TermsSection } from "@shared/booking-terms";

interface TermsEditorProps {
  value: BookingTerms;
  onChange: (terms: BookingTerms) => void;
}

export function TermsEditor({ value, onChange }: TermsEditorProps) {
  const setHeader = (header: string) => onChange({ ...value, header });

  const setSection = (idx: number, updated: TermsSection) => {
    const sections = [...value.sections];
    sections[idx] = updated;
    onChange({ ...value, sections });
  };

  const addSection = () => {
    onChange({
      ...value,
      sections: [...value.sections, { title: `${value.sections.length + 1}. New Section`, content: "" }],
    });
  };

  const removeSection = (idx: number) => {
    onChange({ ...value, sections: value.sections.filter((_, i) => i !== idx) });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const sections = [...value.sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    onChange({ ...value, sections });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Contract Header</Label>
        <Textarea
          rows={3}
          value={value.header}
          onChange={(e) => setHeader(e.target.value)}
          className="text-sm"
          placeholder="Opening paragraph of the contract..."
        />
      </div>

      <div className="space-y-3">
        {value.sections.map((section, idx) => (
          <Card key={idx} className="border-border">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  value={section.title}
                  onChange={(e) => setSection(idx, { ...section, title: e.target.value })}
                  className="h-7 text-sm font-medium"
                  placeholder="Section title..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => moveSection(idx, -1)}
                  disabled={idx === 0}
                  title="Move up"
                >↑</Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => moveSection(idx, 1)}
                  disabled={idx === value.sections.length - 1}
                  title="Move down"
                >↓</Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => removeSection(idx)}
                  title="Remove section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Textarea
                rows={3}
                value={section.content}
                onChange={(e) => setSection(idx, { ...section, content: e.target.value })}
                className="text-xs text-muted-foreground"
                placeholder="Section content..."
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addSection} className="w-full">
        <Plus className="w-4 h-4 mr-1" /> Add Section
      </Button>
    </div>
  );
}
