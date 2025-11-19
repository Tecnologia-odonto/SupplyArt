import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Item {
  id: string;
  name: string;
  code: string;
  unit_measure?: string;
}

interface ItemSearchInputProps {
  items: Item[];
  value: string;
  onChange: (itemId: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

const ItemSearchInput: React.FC<ItemSearchInputProps> = ({
  items,
  value,
  onChange,
  error,
  disabled,
  placeholder = 'Digite o nome ou código do item...'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inicializar com o item selecionado
  useEffect(() => {
    if (value && items.length > 0) {
      const item = items.find(i => i.id === value);
      if (item) {
        setSelectedItem(item);
        setSearchTerm(`${item.name} (${item.code})`);
      }
    }
  }, [value, items]);

  // Filtrar itens baseado na busca
  useEffect(() => {
    if (!searchTerm || searchTerm === `${selectedItem?.name} (${selectedItem?.code})`) {
      setFilteredItems([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term)
    ).slice(0, 10); // Limitar a 10 resultados

    setFilteredItems(filtered);
  }, [searchTerm, items, selectedItem]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setShowDropdown(true);

    // Se limpar o campo, limpar seleção
    if (!newValue) {
      setSelectedItem(null);
      onChange('');
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setSearchTerm(`${item.name} (${item.code})`);
    onChange(item.id);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    setSelectedItem(null);
    onChange('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (!selectedItem && items.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder}
          className={`block w-full pl-10 pr-10 py-2 border rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
            error ? 'border-red-300' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
        {searchTerm && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {showDropdown && filteredItems.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectItem(item)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">Código: {item.code}</p>
                </div>
                {item.unit_measure && (
                  <span className="text-xs text-gray-400">{item.unit_measure}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && searchTerm && filteredItems.length === 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-3 text-base ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          <p className="text-center text-gray-500 text-sm">Nenhum item encontrado</p>
        </div>
      )}
    </div>
  );
};

export default ItemSearchInput;
