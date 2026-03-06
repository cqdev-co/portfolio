'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, Trash2, Plus, Sparkles, Brain } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { updateHouseholdContext } from '@/lib/actions/settings';
import { createAccount, deleteAccount } from '@/lib/actions/accounts';
import { createCategory, deleteCategory } from '@/lib/actions/categories';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currentBalance: number | null;
  lastImported: string | null;
}

interface HouseholdData {
  householdSize: number | null;
  dependents: number | null;
  annualIncome: number | null;
  financialGoals: string | null;
}

interface Category {
  id: string;
  name: string;
  groupName: string;
  icon: string | null;
  isCustom: boolean | null;
}

interface SettingsViewProps {
  accounts: Account[];
  household: HouseholdData | null;
  categoriesByGroup: Record<string, Category[]>;
}

const INSTITUTIONS = [
  { value: 'bofa', label: 'Bank of America' },
  { value: 'chase', label: 'Chase' },
  { value: 'other', label: 'Other' },
];

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
];

export function SettingsView({
  accounts,
  household,
  categoriesByGroup,
}: SettingsViewProps) {
  const router = useRouter();
  const [householdSize, setHouseholdSize] = useState(
    String(household?.householdSize || '')
  );
  const [dependents, setDependents] = useState(
    String(household?.dependents || '')
  );
  const [annualIncome, setAnnualIncome] = useState(
    String(household?.annualIncome || '')
  );
  const [financialGoals, setFinancialGoals] = useState(
    household?.financialGoals || ''
  );
  const [savingHousehold, setSavingHousehold] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📁');

  const [newAcctName, setNewAcctName] = useState('');
  const [newAcctType, setNewAcctType] = useState('checking');
  const [newAcctInst, setNewAcctInst] = useState('bofa');
  const [newAcctBalance, setNewAcctBalance] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Delete this account and all its transactions?')) return;
    await deleteAccount(id);
    router.refresh();
  };

  const handleAddAccount = async () => {
    if (!newAcctName) return;
    setAddingAccount(true);
    await createAccount({
      name: newAcctName,
      type: newAcctType,
      institution: newAcctInst,
      currentBalance: newAcctBalance ? parseFloat(newAcctBalance) : 0,
    });
    setNewAcctName('');
    setNewAcctBalance('');
    setAddingAccount(false);
    router.refresh();
  };

  const handleSaveHousehold = async () => {
    setSavingHousehold(true);
    await updateHouseholdContext({
      householdSize: householdSize ? parseInt(householdSize) : undefined,
      dependents: dependents ? parseInt(dependents) : undefined,
      annualIncome: annualIncome ? parseFloat(annualIncome) : undefined,
      financialGoals: financialGoals || undefined,
    });
    setSavingHousehold(false);
  };

  const handleAddCategory = async () => {
    if (!newCatName || !newCatGroup) return;
    await createCategory({
      name: newCatName,
      groupName: newCatGroup,
      icon: newCatIcon,
    });
    setNewCatName('');
    setNewCatGroup('');
    setNewCatIcon('📁');
    router.refresh();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    router.refresh();
  };

  return (
    <Tabs defaultValue="accounts">
      <TabsList>
        <TabsTrigger value="accounts">Accounts</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="ai">AI Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="accounts" className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Add Account</CardTitle>
            <CardDescription>
              Add your bank accounts here, then import transactions via CSV from
              each bank&apos;s website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input
                  placeholder="e.g. BofA Checking"
                  value={newAcctName}
                  onChange={(e) => setNewAcctName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Starting Balance</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newAcctBalance}
                    onChange={(e) => setNewAcctBalance(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bank</Label>
                <select
                  value={newAcctInst}
                  onChange={(e) => setNewAcctInst(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {INSTITUTIONS.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  value={newAcctType}
                  onChange={(e) => setNewAcctType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              onClick={handleAddAccount}
              disabled={!newAcctName || addingAccount}
            >
              <Plus className="h-4 w-4 mr-2" />
              {addingAccount ? 'Adding...' : 'Add Account'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Your Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                No accounts yet. Add one above to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {accounts.map((acct) => (
                  <div
                    key={acct.id}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{acct.name}</p>
                        <div className="flex gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {INSTITUTIONS.find(
                              (i) => i.value === acct.institution
                            )?.label || acct.institution}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {ACCOUNT_TYPES.find((t) => t.value === acct.type)
                              ?.label || acct.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {formatCurrency(acct.currentBalance || 0)}
                        </p>
                        {acct.lastImported && (
                          <p className="text-[10px] text-muted-foreground">
                            Last import:{' '}
                            {new Date(acct.lastImported).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAccount(acct.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="categories" className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Add Custom Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Icon"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className="w-16"
              />
              <Input
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Group"
                value={newCatGroup}
                onChange={(e) => setNewCatGroup(e.target.value)}
                className="w-[140px]"
              />
              <Button
                onClick={handleAddCategory}
                disabled={!newCatName || !newCatGroup}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {Object.entries(categoriesByGroup).map(([group, cats]) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{group}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cats.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant="secondary"
                    className="text-sm py-1.5 px-3 gap-1.5"
                  >
                    {cat.icon} {cat.name}
                    {cat.isCustom && (
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        &times;
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="ai" className="space-y-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Household Context
            </CardTitle>
            <CardDescription>
              Provide household details so the AI assistant can give more
              personalized advice. All data stays on your machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Household Size</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2"
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(e.target.value)}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Dependents</Label>
                <Input
                  type="number"
                  placeholder="e.g. 0"
                  value={dependents}
                  onChange={(e) => setDependents(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Annual Income</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  placeholder="e.g. 75000"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(e.target.value)}
                  className="pl-7"
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Financial Goals</Label>
              <Input
                placeholder="e.g. Save for a house, pay off student loans, build emergency fund"
                value={financialGoals}
                onChange={(e) => setFinancialGoals(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveHousehold} disabled={savingHousehold}>
              {savingHousehold ? 'Saving...' : 'Save Household Context'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI Provider</span>
              <Badge>Ollama (Local)</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Model</span>
              <Badge variant="outline">
                {process.env.OLLAMA_MODEL || 'llama3.2'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Host</span>
              <Badge variant="outline">
                {process.env.OLLAMA_HOST || 'localhost:11434'}
              </Badge>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Your financial data never leaves your machine. AI queries are
              processed entirely on your local Ollama instance.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
